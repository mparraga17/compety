import type { IdLiga } from './ligas';

/**
 * Qué sesiones avisan a los miembros de una liga.
 *
 * ⭐ Decisión del usuario (17 sep): *"no quiero que sea solo cuando la sesión es fuerte, quiero que
 * sea cuando un amigo ha hecho una sesión"*. Hasta entonces solo avisaba la ÚLTIMA sesión de la
 * semana, y solo si era `fuerte` para quien la hizo (criterio anti-ruido de la teoría de la
 * autodeterminación). Con esa regla, en diez días de beta hubo 25 sesiones de un amigo y un solo
 * aviso: para una app de competir con amigos, el silencio pesaba más que el ruido.
 *
 * La regla nueva es "toda sesión reciente", con una sola condición: que haya terminado en las
 * últimas 24 horas. Sirve para dos cosas:
 *   - Una sesión de hace tres días no es noticia para nadie.
 *   - El primer alta de alguien sincroniza su historial entero (90 días), y sin ventana avisaría a
 *     sus ligas de decenas de sesiones de golpe. El servidor además acota a 10 por liga y día y
 *     deduplica por huella, así que repetir la sincronización no reavisa.
 *
 * El tono ya NO decide si se avisa; sigue viajando en el aviso para que el texto lo cuente.
 */

/** Ventana de "reciente": 24 horas. */
export const VENTANA_AVISO_MS = 24 * 60 * 60_000;

export type SesionAvisable = {
  readonly id: string;
  /** Fin en milisegundos. */
  readonly fin: number;
  /** Liga de deporte a la que pertenece (`ligaDe(tipo)`), o null si no encaja en ninguna. */
  readonly liga: IdLiga | null;
};

/**
 * Sesiones de la liga `filtro` terminadas en las últimas 24 horas, de la más antigua a la más
 * reciente. `'global'` acepta cualquier deporte; una liga de deporte, solo el suyo.
 *
 * `filtro` es el deporte de la liga tal como llega del servidor (`liga.deporte ?? 'global'`), por
 * eso es `string` y no `IdLiga`: el servidor no conoce el tipo del motor.
 */
export function sesionesQueAvisan<S extends SesionAvisable>(
  sesiones: readonly S[],
  ahora: number,
  filtro: IdLiga | string,
): S[] {
  return sesiones
    .filter((s) => s.fin <= ahora && ahora - s.fin <= VENTANA_AVISO_MS)
    .filter((s) => filtro === 'global' || s.liga === filtro)
    .sort((a, b) => a.fin - b.fin);
}
