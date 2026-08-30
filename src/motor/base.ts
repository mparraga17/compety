import { CIENCIA } from './ciencia';

/**
 * Base personal: el handicap del producto.
 *
 * Cada persona compite contra su propio normal, nunca en valores absolutos. Dos motivos con
 * fuente: ninguna formula de pulso maximo acierta a nivel individual, y Fitbit se queda hasta
 * 16 lpm por debajo cuando la intensidad es alta. Comparar cifras crudas entre marcas daria
 * una precision que no existe.
 *
 * Es tambien lo que hace que una clase de barre dura para ti valga lo mismo que un 5k duro
 * para quien corre.
 */

/** Puntuacion que corresponde a la carga media de la persona. */
export const PUNTOS_MEDIA = 50;

/** Cuantos puntos vale cada desviacion tipica. */
export const PUNTOS_POR_SIGMA = 15;

/** Techo y suelo, para que una sesion rara no rompa la escala. */
export const PUNTOS_MIN = 5;
export const PUNTOS_MAX = 100;

/** Cargas minimas para que la media y la sigma signifiquen algo. */
export const CARGAS_MINIMAS = 2;

export type Base = {
  media: number;
  sigma: number;
  /** Cargas usadas para calcularla. */
  n: number;
  /** false mientras no haya historico suficiente. La interfaz debe avisar. */
  fiable: boolean;
};

export const BASE_VACIA: Base = { media: 0, sigma: 0, n: 0, fiable: false };

/**
 * Media y desviacion tipica de las cargas.
 *
 * ⚠️ Hay que recalcularla cada vez que cambia la escala de carga. La carga no es TRIMP crudo,
 * es intensidad ajustada por volumen comprimido, asi que una media vieja daria z sin sentido.
 */
export function baseDeCarga(cargas: readonly number[]): Base {
  const v = cargas.filter((c) => Number.isFinite(c) && c > 0);
  if (v.length < CARGAS_MINIMAS) return { ...BASE_VACIA, n: v.length };

  const media = v.reduce((a, b) => a + b, 0) / v.length;
  const varianza = v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length;

  return {
    media: +media.toFixed(1),
    sigma: +Math.sqrt(varianza).toFixed(1),
    n: v.length,
    // Con menos de 10 sesiones la sigma se mueve mucho al llegar una nueva.
    fiable: v.length >= 10,
  };
}

/** Cuantas sigmas por encima o por debajo de tu media queda esta carga. */
export function zDe(carga: number, base: Base): number {
  if (base.sigma <= 0) return 0;
  return +((carga - base.media) / base.sigma).toFixed(2);
}

export type Puntuacion = {
  puntos: number;
  z: number;
  /** Paso del desglose que ve el usuario. */
  formula: string;
  ciencia: 'basePropia';
};

/**
 * De carga a puntos. Tu media son 50 puntos y cada sigma vale 15.
 *
 * Sin base todavia se devuelve la media, que es lo honesto: no se puede decir si una sesion
 * fue buena o mala sin saber como es tu normal.
 */
export function puntuaCarga(carga: number, base: Base): Puntuacion {
  const z = zDe(carga, base);
  const bruto = PUNTOS_MEDIA + z * PUNTOS_POR_SIGMA;
  const puntos = Math.max(PUNTOS_MIN, Math.min(PUNTOS_MAX, Math.round(bruto)));

  return {
    puntos,
    z,
    formula:
      base.sigma > 0
        ? `tu media es ${base.media}, esta sesión ${carga}, o sea ${z >= 0 ? '+' : ''}${z}σ`
        : `todavía no hay historial para comparar, así que se queda en tu media`,
    ciencia: 'basePropia',
  };
}

/** Banda de lo habitual, media mas y menos una sigma. Es lo que se pinta de fondo. */
export function bandaHabitual(base: Base): { min: number; max: number } | null {
  if (base.sigma <= 0) return null;
  return {
    min: +Math.max(0, base.media - base.sigma).toFixed(1),
    max: +(base.media + base.sigma).toFixed(1),
  };
}

export const FUENTE_BASE = CIENCIA.basePropia;
