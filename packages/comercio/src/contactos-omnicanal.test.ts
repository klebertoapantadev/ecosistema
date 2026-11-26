import { describe, expect, it } from "vitest";
import {
  consolidarContactosJoinMerge,
  normalizarTelefonoE164Contacto,
  parsearFilasTablaContactos,
  parsearListaRapidaContactos,
  parsearVcfContactos,
  ultimos9TelefonoContacto,
} from "./contactos-omnicanal";

describe("contactos-omnicanal · normalización y parsers", () => {
  it("normaliza teléfonos ecuatorianos e internacionales a E.164", () => {
    expect(normalizarTelefonoE164Contacto("099 123 4567")).toBe("+593991234567");
    expect(normalizarTelefonoE164Contacto("+593 99-123-4567")).toBe("+593991234567");
    expect(normalizarTelefonoE164Contacto("593991234567@s.whatsapp.net")).toBe("+593991234567");
    expect(normalizarTelefonoE164Contacto("991234567")).toBe("+593991234567");
    expect(normalizarTelefonoE164Contacto("02 245 6789")).toBe("+59322456789");
    expect(normalizarTelefonoE164Contacto("+1 (305) 555-0199")).toBe("+13055550199");
    expect(ultimos9TelefonoContacto("099 123 4567")).toBe("991234567");
  });

  it("parsea vCard (.vcf) con QUOTED-PRINTABLE UTF-8 y múltiples teléfonos por tarjeta", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:2.1",
      "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Mam=C3=A1 Casa",
      "TEL;CELL:099 888 7777",
      "TEL;HOME:+593 98 111 2222",
      "EMAIL:mama@ejemplo.com",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Cliente Juan Pérez",
      "item1.TEL:+593 99 643 8873",
      "END:VCARD",
    ].join("\r\n");

    const parsed = parsearVcfContactos(vcf, { esAgendaPersonal: true });
    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.nombre).toBe("Mamá Casa");
    expect(parsed[0]?.telefono).toBe("+593998887777");
    expect(parsed[1]?.nombre).toBe("Mamá Casa");
    expect(parsed[1]?.telefono).toBe("+593981112222");
    expect(parsed[2]?.nombre).toBe("Cliente Juan Pérez");
    expect(parsed[2]?.telefono).toBe("+593996438873");
  });

  it("parsea filas CSV/Excel estilo Google Contacts con separador :::", () => {
    const filas = [
      {
        "First Name": "Cliente",
        "Last Name": "María López",
        "Phone 1 - Value": "099 555 1234 ::: +593 98 777 6666",
        "E-mail 1 - Value": "maria@correo.com",
        "Group Membership": "* myContacts ::: Eventos",
      },
    ];
    const parsed = parsearFilasTablaContactos(filas, { origen: "CSV", esAgendaPersonal: true });
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.nombre).toBe("Cliente María López");
    expect(parsed[0]?.telefono).toBe("+593995551234");
    expect(parsed[1]?.telefono).toBe("+593987776666");
    expect(parsed[0]?.etiquetas).toContain("Eventos");
  });

  it("ejecuta Join/Merge deduplicando fuentes y clasificando fail-safe PERSONAL vs CLIENTE", () => {
    const agendaDueno = parsearListaRapidaContactos(
      [
        "Juan Perez, 099 111 2222",
        "Tía Carmen, 099 333 4444",
        "Finca Rosas Cayambe, 099 555 6666",
      ].join("\n"),
      { origen: "VCF", esAgendaPersonal: true, etiquetaFuente: "Celular Dueño" }
    );
    const agendaVentas = parsearListaRapidaContactos("Cliente Juan Perez Flores - +593991112222", {
      origen: "CSV",
      esAgendaPersonal: false,
      etiquetaFuente: "WhatsApp Ventas",
    });

    const { items, resumen } = consolidarContactosJoinMerge({
      brutos: [...agendaDueno, ...agendaVentas],
      semillaCrm: [
        {
          telefonoUltimos9: "991112222",
          telefonoE164: "+593991112222",
          nombre: "Juan Carlos Pérez",
          totalCompras: 3,
          montoAcumulado: 145,
          origen: "CRM_COMPRAS",
        },
      ],
    });

    expect(resumen.totalRegistrosBrutos).toBe(4);
    expect(resumen.totalConsolidados).toBe(3);
    expect(resumen.duplicadosFusionados).toBe(1);
    expect(resumen.totalClientes).toBe(1);
    expect(resumen.totalPersonales).toBe(1);
    expect(resumen.totalProveedoresOInternos).toBe(1);

    const juan = items.find((i) => i.telefonoUltimos9 === "991112222");
    expect(juan?.clasificacion).toBe("CLIENTE");
    expect(juan?.tieneConflictoNombre).toBe(true);
    expect(juan?.visibilidad).toBe("EQUIPO_VENTAS");
    expect(juan?.politicaIa).toBe("SEGUN_LINEA");

    const tia = items.find((i) => i.telefonoUltimos9 === "993334444");
    expect(tia?.clasificacion).toBe("PERSONAL");
    expect(tia?.politicaIa).toBe("SIEMPRE_MANUAL");
    expect(tia?.visibilidad).toBe("IGNORAR_TOTAL");

    const finca = items.find((i) => i.telefonoUltimos9 === "995556666");
    expect(finca?.clasificacion).toBe("PROVEEDOR");
    expect(finca?.politicaIa).toBe("SIEMPRE_MANUAL");
  });
});
