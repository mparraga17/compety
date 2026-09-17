/**
 * Qué sesiones avisan a tus amigos.
 *
 * ⭐ Decisión del usuario (17 sep), en dos partes:
 *   1. *"No quiero que sea solo cuando la sesión es fuerte, quiero que sea cuando un amigo ha hecho
 *      una sesión"*. Hasta entonces solo avisaba la ÚLTIMA sesión de la semana, y solo si era
 *      `fuerte` para quien la hizo (criterio anti-ruido de la teoría de la autodeterminación). Con
 *      esa regla, en diez días de beta hubo 25 sesiones de un amigo y un solo aviso.
 *   2. *"A la liga no, a tus amigos solo"*: el aviso iba a los miembros de cada liga del autor (una
 *      liga de zona tiene cientos, y compartir dos ligas duplicaba el aviso). Ahora es UN aviso por
 *      sesión y lo reparte el servidor entre los amigos (`destinatarios_de`, migración 14). Las
 *      ligas y el deporte de la sesión ya no intervienen: un amigo se entera de todo lo tuyo, como
 *      en el feed.
 *
 * La única condición es que la sesión haya terminado en las últimas 24 horas. Sirve para dos cosas:
 *   - Una sesión de hace tres días no es noticia para nadie.
 *   - El primer alta de alguien sincroniza su historial entero (90 días), y sin ventana avisaría a
 *     sus amigos de decenas de sesiones de golpe. El servidor además acota a 30 avisos por persona y
 *     día y deduplica por sesión, así que repetir la sincronización no reavisa.
 *
 * El tono ya NO decide si se avisa; sigue viajando en el aviso para que el texto lo cuente.
 */

/** Ventana de "reciente": 24 horas. */
export const VENTANA_AVISO_MS = 24 * 60 * 60_000;

export type SesionAvisable = {
  readonly id: string;
  /** Fin en milisegundos. */
  readonly fin: number;
};

/** Sesiones terminadas en las últimas 24 horas, de la más antigua a la más reciente. */
export function sesionesQueAvisan<S extends SesionAvisable>(sesiones: readonly S[], ahora: number): S[] {
  return sesiones
    .filter((s) => s.fin <= ahora && ahora - s.fin <= VENTANA_AVISO_MS)
    .sort((a, b) => a.fin - b.fin);
}
