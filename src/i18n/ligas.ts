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

/** Ordinal correcto en cada idioma: 3º en español, 3rd en inglés. */
export function ordinal(n: number, idioma: Idioma): string {
  if (idioma === 'es') return `${n}º`;
  const reglas = new Intl.PluralRules('en', { type: 'ordinal' });
  const sufijos: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
  return `${n}${sufijos[reglas.select(n)] ?? 'th'}`;
}
