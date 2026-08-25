// Consola de agentes: acceso de ADMINISTRACION a ARIA, acotado a un tenant.
//
// Server-only. La key de tenant no puede llegar nunca al navegador.
//
// POR QUE UNA KEY DE TENANT Y NO EL TOKEN DE SUPERADMIN. El aislamiento no
// depende de que esta pantalla se porte bien: esta en el backend de ARIA
// (app/auth.py), y se verifico leyendolo:
//
//   - `require_tenant_scope` devuelve el tenant_id DE LA PROPIA KEY e IGNORA el
//     header X-Aria-Tenant para todo principal que no sea superadmin.
//     Falsificar ese header no sirve de nada.
//   - `assert_tenant_access` responde 404 —no 403— ante un recurso de otro
//     tenant: ni siquiera confirma que exista.
//   - Todo /v1/tenants* exige `require_super`. Con una key de tenant no se
//     pueden listar tenants, ni crear uno, ni emitir mas keys.
//
// Con el token de superadmin, en cambio, un fallo en la lista blanca del proxy
// expondria los cuatro negocios y los tenants de otros clientes.

export interface ConfiguracionConsola {
  baseUrl: string;
  tenantKey: string;
  /**
   * Secreto del gate `X-Aria-Key` del proxy inverso de ARIA.
   *
   * SON DOS COSAS DISTINTAS y hacen falta las dos. El proxy (nginx/Caddy) corta
   * con 401 todo `/agentes/` que no traiga un `X-Aria-Key` conocido, antes de
   * que ARIA vea la peticion — salvo /health y /invoke, que estan exentos por
   * diseño. Ese gate NO identifica a nadie: solo dice "esta llamada viene de un
   * sistema autorizado". Quien identifica es la `tenantKey`, y es la que acota
   * el alcance a un solo tenant.
   *
   * tranqi-web usa un secreto de gate PROPIO, no el token de superadmin (que es
   * el otro valor que el gate acepta): si esta variable se filtrara, quien la
   * tenga seguiria necesitando una credencial de ARIA, y la que hay aqui solo
   * llega a tranqi.
   */
  gateKey: string;
}

export function resolverConsolaDesdeEntorno(prefijo: string): ConfiguracionConsola | null {
  const baseUrl = process.env[`${prefijo}_BASE`];
  const tenantKey = process.env[`${prefijo}_TENANT_KEY`];
  const gateKey = process.env[`${prefijo}_GATE_KEY`];
  if (!baseUrl || !tenantKey || !gateKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), tenantKey, gateKey };
}

export interface RespuestaConsola {
  estado: number;
  datos: unknown;
}

/**
 * Llama a la API de ARIA con la key del tenant.
 *
 * NO valida la ruta: eso es responsabilidad de quien llama, que es el unico que
 * sabe si el usuario esta autorizado. Ver la lista blanca del Route Handler.
 */
export async function llamarConsola(
  config: ConfiguracionConsola,
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
): Promise<RespuestaConsola> {
  const respuesta = await fetch(`${config.baseUrl}${ruta}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      "X-Aria-Key": config.gateKey,
      Authorization: `Bearer ${config.tenantKey}`,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(60000),
  });

  const texto = await respuesta.text();
  let datos: unknown = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }
  return { estado: respuesta.status, datos };
}
