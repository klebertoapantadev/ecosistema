import { describe, expect, it } from "vitest";
import {
  claveNombreParaFusionPersona,
  depurarAgenda2D,
  formatearTelefonoEstandar,
  generarCsvGoogleContacts,
  generarVcfLimpioV3,
  limpiarNombreContacto,
  parsearVcfAFichasAgenda,
  separarFichaDepurada,
  OPCIONES_DEPURADOR_DEFECTO,
} from "./depurador-agenda";

describe("depurador-agenda · motor 2D, estandarización y exportadores", () => {
  it("estandariza teléfonos Ecuador (incluidos pre-2012) e internacionales en modo legible y compacto", () => {
    const ecMovil = formatearTelefonoEstandar("099-123-4567", "E164_LEGIBLE");
    expect(ecMovil?.valorE164).toBe("+593991234567");
    expect(ecMovil?.valorFormateado).toBe("+593 99 123 4567");
    expect(ecMovil?.fueCorregido).toBe(true);

    const pre2012 = formatearTelefonoEstandar("095447253", "E164_LEGIBLE");
    expect(pre2012?.valorE164).toBe("+593995447253");
    expect(pre2012?.valorFormateado).toBe("+593 99 544 7253");
    expect(pre2012?.fuePre2012Ecuador).toBe(true);

    const compacto = formatearTelefonoEstandar("02 245 6789", "E164_COMPACTO");
    expect(compacto?.valorFormateado).toBe("+59322456789");

    const usa = formatearTelefonoEstandar("+13055550199", "E164_LEGIBLE");
    expect(usa?.valorFormateado).toBe("+1 305 555 0199");
  });

  it("limpia caracteres invisibles (Braille blank), símbolos iniciales y normaliza mayúsculas preservando siglas", () => {
    const braille = limpiarNombreContacto("\u2800Alejandro Tipantuña", {
      limpiarSimbolosInicio: true,
      normalizarMayusculas: false,
      quitarEmojis: false,
    });
    expect(braille.nombre).toBe("Alejandro Tipantuña");
    expect(braille.fueLimpiado).toBe(true);

    const simbolos = limpiarNombreContacto("::: PAUL BPAC :::", {
      limpiarSimbolosInicio: true,
      normalizarMayusculas: true,
      quitarEmojis: false,
    });
    expect(simbolos.nombre).toBe("Paul BPAC");

    const sinEmojis = limpiarNombreContacto("Fer Lugmaña ☺️☺️", {
      limpiarSimbolosInicio: true,
      normalizarMayusculas: false,
      quitarEmojis: true,
    });
    expect(sinEmojis.nombre).toBe("Fer Lugmaña");
  });

  it("evita falsas fusiones por nombre genérico pero detecta misma persona con sufijo Nuevo", () => {
    expect(claveNombreParaFusionPersona("Cliente Girasoles")).toBeNull();
    expect(claveNombreParaFusionPersona("Eventos 14")).toBeNull();
    expect(claveNombreParaFusionPersona("Juan")).toBeNull();
    expect(claveNombreParaFusionPersona("Alejandro Tipantuña")).toBe("alejandro tipantuna");
    expect(claveNombreParaFusionPersona("\u2800Alejandro Tipantuña Nuevo")).toBe(
      "alejandro tipantuna"
    );
  });

  it("ejecuta fusión 2D (teléfono + persona), preserva campos, excluye patrones, permite separar y genera VCF v3.0 + CSV Google", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:2.1",
      "FN:Carolina Michell",
      "TEL;CELL:0995907889",
      "EMAIL:caro@correo.com",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:2.1",
      "FN:Caro",
      "TEL;CELL:+593 99 590 7889",
      "ORG:Familia",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:2.1",
      "FN:\u2800Alejandro Tipantuña",
      "TEL;CELL:+593993434305",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:2.1",
      "FN:Alejandro Tipantuña Nuevo",
      "TEL;CELL:+593995263033",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:2.1",
      "FN:CS Ramo De Novia",
      "TEL;CELL:+593991112222",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:2.1",
      "FN:Cliente Juan Perez",
      "TEL;CELL:0987654321",
      "END:VCARD",
    ].join("\r\n");

    const crudas = parsearVcfAFichasAgenda(vcf, { esAgendaPersonal: true });
    expect(crudas).toHaveLength(6);

    const { fichas, excluidas, resumen } = depurarAgenda2D(crudas, {
      ...OPCIONES_DEPURADOR_DEFECTO,
      patronesExcluir: ["cs"],
    });

    expect(excluidas).toHaveLength(1);
    expect(resumen.excluidosPorRegla).toBe(1);
    expect(fichas).toHaveLength(3); // Carolina (fusionada por tel), Alejandro (fusionado por persona), Juan (cliente)
    expect(resumen.duplicadosEliminados).toBe(2);

    const ale = fichas.find((f) => f.nombreLimpio.includes("Alejandro"));
    expect(ale?.motivoFusion).toBe("MISMA_PERSONA");
    expect(ale?.telefonos).toHaveLength(2);

    const caro = fichas.find((f) => f.nombreLimpio === "Carolina Michell");
    expect(caro?.motivoFusion).toBe("MISMO_TELEFONO");
    expect(caro?.correos).toEqual(["caro@correo.com"]);
    expect(caro?.empresa).toBe("Familia");
    expect(caro?.notas).toContain("Caro");

    // Separar manualmente a Alejandro vuelve a 4 fichas
    const separadas = separarFichaDepurada(fichas, ale!.id, OPCIONES_DEPURADOR_DEFECTO);
    expect(separadas).toHaveLength(4);

    // Exportar VCF v3.0 y CSV Google Contacts
    const vcfOut = generarVcfLimpioV3(fichas);
    expect(vcfOut).toContain("VERSION:3.0");
    expect(vcfOut).toContain("FN:Cliente Juan Perez");
    expect(vcfOut).toContain("TEL;TYPE=CELL:+593 98 765 4321");
    expect(vcfOut).toContain("CATEGORIES:Clientes");

    const csvOut = generarCsvGoogleContacts(fichas);
    expect(csvOut).toContain("Group Membership");
    expect(csvOut).toContain("* myContacts ::: Clientes");
    expect(csvOut).toContain("+593 99 343 4305");
    expect(csvOut).toContain("+593 99 526 3033");
  });
});
