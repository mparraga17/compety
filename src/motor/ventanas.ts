/**
 * ⭐ Ventanas temporales del motor. Tres, y cada una responde a una pregunta distinta:
 *
 *   lectura   desde el 1 de enero, o 90 dias si estamos a menos de 90 dias del 1 de enero.
 *             Es lo que hace que la clasificacion ANUAL sea anual: antes se leian 30 dias y el
 *             ranking del año era "tus mejores de este mes". Decision de producto, 15 sep 2026.
 *   base      los ultimos 90 dias. "Tu normal" es lo que haces ultimamente, no la media de
 *             enero. Misma ventana que el maximo de FC y que las metricas de Salud.
 *   asentado  una sesion con mas de 3 dias es definitiva: la pulsera ya volco lo que tuviera.
 *             Sus pulsos se guardan y no se vuelven a pedir a HealthKit.
 *
 * Viven aqui, en el motor y sin dependencias, para poder probarlas en Windows: `sincroniza.ts`
 * importa HealthKit y no se puede cargar en jest.
 */

const DIA = 86_400_000;

export const DIAS_BASE = 90;
export const DIAS_ASENTAMIENTO = 3;

/** Desde cuando se leen sesiones: el 1 de enero, o hace 90 dias si es anterior. */
export function inicioDeLectura(ahora: Date = new Date()): Date {
  const enero = new Date(ahora.getFullYear(), 0, 1);
  const hace90 = new Date(ahora.getTime() - DIAS_BASE * DIA);
  return enero < hace90 ? enero : hace90;
}

/** Desde cuando (ms) cuentan las sesiones para la base personal. */
export function inicioDeBase(ahora: Date = new Date()): number {
  return ahora.getTime() - DIAS_BASE * DIA;
}

/** Antes de este instante (ms), una sesion esta asentada y sus pulsos se pueden guardar. */
export function limiteAsentado(ahora: Date = new Date()): number {
  return ahora.getTime() - DIAS_ASENTAMIENTO * DIA;
}
