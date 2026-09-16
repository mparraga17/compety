import type { Idioma } from './textos';

/**
 * Fechas en palabras, sin `Intl`.
 *
 * ⛔ Escritas a mano y NO con `Intl.DateTimeFormat`, aunque Hermes lo soporte. Es la regla del
 * proyecto desde que `Intl.PluralRules` reventó la app: nada de `Intl` en código del teléfono.
 *
 * Nació con la cabecera grande de las pestañas (rediseño del 15 sep): la línea de contexto de
 * Hoy es la fecha, "martes 15 de septiembre", que antes no existía en ningún sitio.
 */

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const MESES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "martes 15 de septiembre" · "Tuesday, September 15". */
export function fechaLarga(fecha: Date, idioma: Idioma): string {
  const dia = fecha.getDate();
  if (idioma === 'es') {
    return `${DIAS_ES[fecha.getDay()]} ${dia} de ${MESES_ES[fecha.getMonth()]}`;
  }
  return `${DIAS_EN[fecha.getDay()]}, ${MESES_EN[fecha.getMonth()]} ${dia}`;
}
