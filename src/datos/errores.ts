/**
 * Traduccion de errores a algo que una persona pueda leer.
 *
 * ⛔ Nace de un fallo real: al crear una liga la pantalla mostraba **"[object Object]"**. La causa
 * es que `supabase-js` NO lanza `Error`, devuelve un objeto `PostgrestError` plano
 * (`{ message, code, details, hint }`). Al hacer `e instanceof Error ? e.message : String(e)`,
 * cae en la rama de `String(e)`, que sobre un objeto da literalmente "[object Object]".
 *
 * O sea que el mensaje real venia en el objeto y la app lo tiraba a la basura. Costo una ronda
 * entera de diagnostico contra la base de datos averiguar que era un 42702.
 *
 * ⚠️ Regla para las pantallas: no volver a escribir `String(e)` a mano. Usar `mensajeDe(e)`.
 */

/** Lo que devuelve supabase-js en `error`, que no es un Error de JS. */
type ErrorSupabase = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
};

/**
 * Errores conocidos del servidor, con su version legible.
 *
 * Se comparan por texto porque las funciones `SECURITY DEFINER` lanzan `raise exception` con
 * mensaje propio, y ese mensaje es el contrato. Los codigos SQLSTATE se cubren aparte.
 */
const CONOCIDOS: readonly (readonly [string, string])[] = [
  ['hace falta sesion', 'Tienes que entrar de nuevo.'],
  ['codigo no valido', 'Ese código de liga no existe. Revísalo, son seis caracteres.'],
  ['usuario ocupado', 'Ese nombre de usuario ya está cogido. Prueba otro.'],
  ['usuario no valido', 'Entre 3 y 20 caracteres: letras, números y guion bajo.'],
  ['usuario-no-valido', 'Entre 3 y 20 caracteres: letras, números y guion bajo.'],
  ['no estas en esa liga', 'No estás en esa liga.'],
  ['esa persona no es tu amigo', 'Tenéis que ser amigos antes de invitar a una liga.'],
  ['esa persona no existe', 'No hay nadie con ese nombre de usuario.'],
  ['no hay peticion pendiente', 'Esa petición ya no está disponible.'],
  ['no puedes agregarte a ti mismo', 'Ese eres tú.'],
  ['esa semana ya esta cerrada', 'Esa semana ya está cerrada y no cambia.'],
  ['no se pudo generar codigo', 'No se pudo crear la liga. Prueba otra vez.'],
  ['sin-servidor', 'No hay conexión con el servidor.'],
  // Borrado de cuenta (Edge Function `borrar-cuenta`): Apple tiene que revocar antes de borrar.
  ['apple-no-revocado', 'No hemos podido cerrar tu sesión de Apple. Vuelve a intentarlo.'],
  ['apple-sin-codigo', 'Apple no devolvió la autorización. Vuelve a intentarlo.'],
  ['no se pudo borrar la cuenta', 'No se pudo borrar la cuenta. Vuelve a intentarlo en un momento.'],
  ['primero hay que crear el perfil', 'Falta tu nombre. Vuelve a entrar para completarlo.'],
  // El servidor acota las fechas que manda el teléfono a ±2 días de la suya (migraciones 10 y
  // 12). Solo salta con un reloj muy desajustado, y entonces la salida es arreglar el reloj.
  ['fecha fuera de rango', 'La fecha de tu teléfono no cuadra con la del servidor. Revisa la hora.'],
  ['periodo fuera de rango', 'La fecha de tu teléfono no cuadra con la del servidor. Revisa la hora.'],
];

/** Fallos de red, que no son culpa de nadie y merecen otro tono. */
const RED = ['network request failed', 'fetch failed', 'timeout', 'econnrefused'];

/**
 * Convierte cualquier cosa lanzada en un texto para la interfaz.
 *
 * Orden: mensaje conocido → fallo de red → mensaje en crudo del servidor → ultimo recurso.
 * Nunca devuelve "[object Object]".
 */
export function mensajeDe(e: unknown): string {
  const crudo = textoCrudo(e);
  const bajo = crudo.toLowerCase();

  for (const [aguja, legible] of CONOCIDOS) {
    if (bajo.includes(aguja)) return legible;
  }

  if (RED.some((r) => bajo.includes(r))) {
    return 'Sin conexión. Comprueba la red y vuelve a intentarlo.';
  }

  // Se devuelve el mensaje del servidor tal cual: es mas util que un "algo ha ido mal" cuando
  // aparece un caso nuevo, y en desarrollo ahorra tener que mirar los logs.
  if (crudo.length > 0 && crudo !== '[object Object]') return crudo;

  return 'Algo no ha ido bien. Vuelve a intentarlo.';
}

/** Saca el texto de un Error, de un PostgrestError o de lo que sea. */
function textoCrudo(e: unknown): string {
  if (e === null || e === undefined) return '';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;

  if (typeof e === 'object') {
    const o = e as ErrorSupabase;
    // `message` es lo unico que trae siempre supabase-js. `details` y `hint` ayudan a depurar.
    const partes = [o.message, o.details, o.hint].filter(
      (x): x is string => typeof x === 'string' && x.length > 0,
    );
    if (partes.length > 0) return partes.join(' · ');

    // Ultimo intento antes de rendirse: serializar. Mejor un JSON feo que "[object Object]".
    try {
      const j = JSON.stringify(e);
      if (j !== undefined && j !== '{}') return j;
    } catch {
      // Referencias circulares: se ignora y cae al String de abajo.
    }
  }

  return String(e);
}
