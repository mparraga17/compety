/**
 * La semana del motor: de lunes a domingo, en hora LOCAL del dispositivo.
 *
 * Es la unidad que comparten la liga (`wtd`), la racha y las celebraciones, así que se calcula en
 * UN sitio. Antes había cuatro copias (ranking, racha y dos en App), y una de ellas tenía el bug
 * de cambio de hora que se describe abajo. Cuatro copias son cuatro sitios donde volver a
 * tenerlo.
 *
 * ⛔ REGLA: los días se mueven con `setDate`, NUNCA restando `n × 86.400.000 ms`. Un día de
 * calendario no siempre dura 24 h: el del cambio de hora dura 23 o 25. Restar horas para llegar
 * al lunes anterior daba las 23:00 del domingo (o la 01:00 del lunes) al cruzar el cambio, y esa
 * clave ya no coincidía con la de las sesiones agrupadas por su lunes real: todas las semanas
 * anteriores al cambio salían vacías y la racha de todo el mundo se rompía dos veces al año.
 * `setDate` mueve el calendario y deja que el motor de fechas resuelva las horas de cada día.
 *
 * ⚠️ Zona horaria: la del dispositivo, a propósito y todavía como decisión abierta de producto
 * (ver `desdeDe` en ranking.ts). Este módulo no la decide; solo garantiza que, sea cual sea, el
 * lunes sea el lunes.
 */

/** Lunes 00:00 local de la semana que contiene el instante `t` (ms). */
export function lunesDe(t: number): number {
  const d = new Date(t);
  // Domingo es 0 en JS; con `+6 % 7` el lunes pasa a ser 0 y el domingo 6.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** El lunes 00:00 local anterior a un lunes dado. */
export function lunesAnterior(lunes: number): number {
  const d = new Date(lunes);
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Clave estable de una semana para persistir ("ya celebrado esta semana"): el lunes como
 * `AAAA-M-D` local. Va aquí para que la misma semana tenga la misma clave en toda la app.
 */
export function claveSemana(t: number): string {
  const d = new Date(lunesDe(t));
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
