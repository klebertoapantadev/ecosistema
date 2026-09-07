import { crearClienteAdmin } from "@eco/supabase/servidor";

/**
 * Núcleo del despachador de tareas programadas (PLT-021).
 *
 * Vive aquí, y no en una ruta de Next ni en pg_cron, porque PLT-020 regla 8
 * exige que el ecosistema pueda mudarse de Vercel a un servidor Linux propio sin
 * tocar código. Quien dispara es intercambiable —tarea de `vercel.json`,
 * `crontab`, `systemd`, o pg_cron—; lo que no cambia es esto.
 *
 * El trabajo en sí ocurre en `comun_tareas.tar_fn_despachar`, en la base. No es
 * una comodidad: marcar un aviso como enviado y enviarlo tienen que ocurrir o no
 * ocurrir juntos, y eso es una transacción. Traer las filas hasta aquí para
 * devolverlas escritas rompería esa garantía y añadiría latencia de red por cada
 * cita. Esta capa aporta lo que la base no puede: autenticación del disparo,
 * aislamiento del fallo y una respuesta que alguien pueda monitorizar.
 */

export type EstadoTarea = "ok" | "error";

export interface ResultadoTarea {
  tarea: string;
  estado: EstadoTarea;
  filas?: number;
  error?: string;
}

export interface ResumenDespacho {
  origen: string;
  ejecutado_en: string;
  fallos: number;
  tareas: ResultadoTarea[];
}

/** Lo que el disparador de turno dice ser. Solo alimenta la bitácora. */
export type OrigenDespacho = "vercel_cron" | "linux_cron" | "pg_cron" | "manual" | "cli";

/**
 * Comprueba la cabecera `Authorization` contra `CRON_SECRET`.
 *
 * Sin secreto configurado se rechaza todo: un despachador abierto a internet
 * deja que cualquiera provoque el envío de notificaciones a los afiliados. Es
 * preferible que la tarea no corra —y se note— a que corra para quien quiera.
 */
export function autorizacionCronValida(cabecera: string | null): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  if (!cabecera) return false;

  const esperado = `Bearer ${secreto}`;
  if (cabecera.length !== esperado.length) return false;

  // Comparación de tiempo constante: un `===` filtra por su tiempo de ejecución
  // cuántos caracteres iniciales coinciden, y eso permite adivinar el secreto
  // carácter a carácter contra un endpoint público.
  let diferencia = 0;
  for (let i = 0; i < esperado.length; i += 1) {
    diferencia |= cabecera.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diferencia === 0;
}

/**
 * Ejecuta una pasada del despachador.
 *
 * No lanza: devuelve el resumen con los fallos dentro. Quien la invoca es un
 * cron, y un cron que recibe una excepción solo sabe reintentar; lo que hace
 * falta es que quede escrito qué tarea falló y por qué.
 */
export async function despacharTareasProgramadas(
  origen: OrigenDespacho = "manual"
): Promise<ResumenDespacho> {
  const ahora = new Date().toISOString();
  const supabase = crearClienteAdmin();

  if (!supabase) {
    return {
      origen,
      ejecutado_en: ahora,
      fallos: 1,
      tareas: [{
        tarea: "conexion",
        estado: "error",
        error: "Sin credenciales de servicio: falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL"
      }]
    };
  }

  const { data, error } = await supabase
    .schema("comun_tareas")
    .rpc("tar_fn_despachar", { p_origen: origen });

  if (error) {
    return {
      origen,
      ejecutado_en: ahora,
      fallos: 1,
      tareas: [{ tarea: "despacho", estado: "error", error: error.message }]
    };
  }

  return data as unknown as ResumenDespacho;
}
