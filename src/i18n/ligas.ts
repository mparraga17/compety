import type { IdLiga } from '../motor/ligas';
import type { IdHorizonte } from '../motor/ranking';
import type { Idioma } from './textos';

/**
 * Nombres de ligas y ventanas temporales.
 *
 * Viven aqui y no dentro de LIGAS ni HORIZONTES por una leccion que costo un bug: en la maqueta
 * el JSON llevaba `nombre: 'Tú'` dentro del dato, y con la app en inglés seguia saliendo "Tú",
 * porque la interfaz solo lo imprimia. Regla: un dato nunca lleva texto traducible dentro.
 */

const LIGAS_ES: Record<IdLiga, string> = {
  global: 'General',
  padel: 'Pádel',
  tenis: 'Tenis',
  correr: 'Correr',
  estudio: 'Estudio',
  fuerza: 'Fuerza',
  golf: 'Golf',
  paseo: 'Caminar',
};

const LIGAS_EN: Record<IdLiga, string> = {
  global: 'Overall',
  padel: 'Padel',
  tenis: 'Tennis',
  correr: 'Running',
  estudio: 'Studio',
  fuerza: 'Strength',
  golf: 'Golf',
  paseo: 'Walking',
};

const HORIZONTES_ES: Record<IdHorizonte, string> = {
  wtd: 'Esta semana',
  d7: 'Últimos 7 días',
  mtd: 'Este mes',
  d30: 'Últimos 30 días',
  ytd: 'Este año',
};

const HORIZONTES_EN: Record<IdHorizonte, string> = {
  wtd: 'This week',
  d7: 'Last 7 days',
  mtd: 'This month',
  d30: 'Last 30 days',
  ytd: 'This year',
};

export function nombreLiga(id: IdLiga, idioma: Idioma): string {
  return idioma === 'es' ? LIGAS_ES[id] : LIGAS_EN[id];
}

export function nombreHorizonte(id: IdHorizonte, idioma: Idioma): string {
  return idioma === 'es' ? HORIZONTES_ES[id] : HORIZONTES_EN[id];
}

/**
 * Nombre CORTO del horizonte, para el control segmentado de la clasificación (15 sep): cinco
 * opciones en una fila no dejan sitio a "Últimos 30 días". "Semana" es la de calendario y
 * "7 días" la móvil, que es la distinción que importa.
 */
const HORIZONTES_CORTOS_ES: Record<IdHorizonte, string> = {
  wtd: 'Semana',
  d7: '7 días',
  mtd: 'Mes',
  d30: '30 días',
  ytd: 'Año',
};

const HORIZONTES_CORTOS_EN: Record<IdHorizonte, string> = {
  wtd: 'Week',
  d7: '7 days',
  mtd: 'Month',
  d30: '30 days',
  ytd: 'Year',
};

export function nombreHorizonteCorto(id: IdHorizonte, idioma: Idioma): string {
  return idioma === 'es' ? HORIZONTES_CORTOS_ES[id] : HORIZONTES_CORTOS_EN[id];
}

/**
 * Etiqueta de la persona que usa la app.
 *
 * Se resuelve aqui, no en el dato. En el JSON esa persona va como `{ nombre: null, esYo: true }`
 * y la comparacion se hace por la bandera, nunca por el texto.
 */
export function etiquetaPersona(nombre: string | null, esYo: boolean, idioma: Idioma): string {
  if (!esYo) return nombre ?? '';
  return idioma === 'es' ? 'Tú' : 'You';
}

/** Inicial del avatar. Depende del idioma cuando la persona es quien usa la app. */
export function inicialPersona(nombre: string | null, esYo: boolean, idioma: Idioma): string {
  const texto = etiquetaPersona(nombre, esYo, idioma);
  return texto.slice(0, 1).toUpperCase();
}

/**
 * Ordinal correcto en cada idioma: 3º en español, 3rd en inglés.
 *
 * ⛔ NO usar `Intl.PluralRules`. Reventó la app en el iPhone con *"undefined cannot be used as a
 * constructor"*, porque **Hermes no lo implementa**. La
 * [doc oficial de Hermes](https://github.com/facebook/hermes/blob/main/doc/IntlAPIs.md) lista lo
 * que sí soporta (`Collator`, `NumberFormat`, `DateTimeFormat`, `getCanonicalLocales`) y
 * `PluralRules` no está. Y no salta en `tsc`, porque los tipos de TypeScript describen la norma
 * ECMA-402, no lo que el motor trae de verdad.
 *
 * 📌 Regla para este proyecto: **nada de `Intl` en código que corra en el teléfono.** Los tests de
 * Node pasan igual porque Node sí lo tiene, así que un test verde tampoco te salva. Las reglas de
 * ordinales en inglés son cuatro y caben aquí.
 */
export function ordinal(n: number, idioma: Idioma): string {
  if (idioma === 'es') return `${n}º`;

  // 11, 12 y 13 son la excepción: son 'th' aunque acaben en 1, 2 y 3.
  const dosUltimos = n % 100;
  if (dosUltimos >= 11 && dosUltimos <= 13) return `${n}th`;

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
