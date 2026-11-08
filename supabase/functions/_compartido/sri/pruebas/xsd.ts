// Validación XSD para los tests, delegada en lxml (python). Si python o lxml no
// están disponibles el test falla: no se da por bueno un XML sin validarlo.
const RUTA_XSD = new URL("./xsd/", import.meta.url);
const SCRIPT = new URL("./validar_xsd.py", import.meta.url);

export async function erroresXsd(xml: string, tipo: "01" | "04"): Promise<string[]> {
  const xsd = new URL(tipo === "01" ? "factura_V1.1.0.xsd" : "NotaCredito_V1.1.0.xsd", RUTA_XSD);
  const proceso = new Deno.Command("python", {
    args: [decodeURIComponent(SCRIPT.pathname.replace(/^\/(\w:)/, "$1")), decodeURIComponent(xsd.pathname.replace(/^\/(\w:)/, "$1"))],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const escritor = proceso.stdin.getWriter();
  await escritor.write(new TextEncoder().encode(xml));
  await escritor.close();
  const { code, stdout, stderr } = await proceso.output();
  if (code === 0) return [];
  const salida = new TextDecoder().decode(stdout).trim();
  if (!salida) throw new Error("validar_xsd.py falló: " + new TextDecoder().decode(stderr));
  return salida.split("\n");
}
