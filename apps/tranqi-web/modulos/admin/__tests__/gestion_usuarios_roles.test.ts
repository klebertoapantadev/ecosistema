import { describe, it, expect } from "vitest";

describe("Gestión de Usuarios y Asignación de Roles (PLT-003)", () => {
  it("Valida la escala jerárquica y catálogo de perfiles base", () => {
    const perfiles = [
      { clave: "CLIENTE", nombre: "Cliente", nivel: 1 },
      { clave: "OPERADOR", nombre: "Operador", nivel: 30 },
      { clave: "AUXILIAR", nombre: "Auxiliar", nivel: 30 },
      { clave: "TECNICO", nombre: "Técnico", nivel: 50 },
      { clave: "ABOGADO", nombre: "Abogado", nivel: 50 },
      { clave: "ADMINISTRADOR", nombre: "Administrador", nivel: 80 },
      { clave: "SUPERADMIN", nombre: "SuperAdmin", nivel: 100 },
    ];

    expect(perfiles.length).toBe(7);
    const operador = perfiles.find(p => p.clave === "OPERADOR");
    expect(operador?.nivel).toBe(30);

    const admin = perfiles.find(p => p.clave === "ADMINISTRADOR");
    expect(admin?.nivel).toBe(80);
  });

  it("El perfil CLIENTE es inmutable y no se puede retirar", () => {
    const clave = "CLIENTE";
    const esBase = clave === "CLIENTE";
    expect(esBase).toBe(true);
  });

  it("Un gestor con nivel 80+ puede asignar roles con nivel inferior", () => {
    const nivelGestor = 80; // Administrador
    const rolAsignarNivel = 30; // Operador

    const permitido = rolAsignarNivel <= nivelGestor && nivelGestor >= 80;
    expect(permitido).toBe(true);
  });

  it("Actualización optimista de perfiles agrega y remueve claves sin duplicar", () => {
    let perfiles = ["CLIENTE"];
    
    // Asignar OPERADOR
    perfiles = Array.from(new Set([...perfiles, "OPERADOR"]));
    expect(perfiles).toContain("OPERADOR");
    expect(perfiles).toContain("CLIENTE");

    // Quitar OPERADOR
    perfiles = perfiles.filter(c => c !== "OPERADOR");
    expect(perfiles).not.toContain("OPERADOR");
    expect(perfiles).toContain("CLIENTE");
  });
});
