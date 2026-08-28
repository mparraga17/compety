/**
 * MET oficiales del Compendium of Physical Activities 2024.
 * pacompendium.com · J Sport Health Sci 2024 · https://pubmed.ncbi.nlm.nih.gov/38242596/
 *
 * 1114 actividades, 912 con el gasto MEDIDO por calorimetria indirecta. Estos valores
 * sustituyeron a los factores que estaban puestos a ojo.
 */
export const MET = {
  RUNNING: 9.8,
  TRAIL_RUNNING: 9.8,
  TREADMILL: 9.0,
  TENNIS: 8.0,
  PADEL: 6.8,
  BADMINTON: 5.5,
  SQUASH: 7.3,
  STRENGTH_TRAINING: 6.0,
  WORKOUT: 5.0,
  CIRCUIT_TRAINING: 5.0,
  BARRE: 4.8,
  PILATES: 2.8,
  YOGA: 2.3,
  DANCE: 5.0,
  GOLF: 4.3,
  WALKING: 3.8,
  HIKING: 5.3,
  SWIMMING: 5.8,
  BIKING: 7.5,
  PADDLEBOARDING: 6.0,
  SPORT: 5.0,
} as const;

export type TipoDeporte = keyof typeof MET;

/**
 * Intensidad de referencia: cuantos MET implica un TRIMP/min.
 * Calibrado con correr, que es donde la FC funciona mejor: 2,85 TRIMP/min con 9,8 MET.
 */
export const MET_POR_TRIMPMIN = 9.8 / 2.85;

/** Compresion del volumen. La cuarta hora aporta menos que la primera (JACC 2023). */
export const K_VOLUMEN = 0.65;

/** Duracion minima para tratarlo como sesion y no como registro accidental. */
export const MINUTOS_MINIMOS = 5;

/** Limites del factor de modalidad, para que ninguna correccion se descontrole. */
export const FACTOR_MIN = 0.85;
export const FACTOR_MAX = 1.75;

export function metDe(tipo: string): number | null {
  return tipo in MET ? MET[tipo as TipoDeporte] : null;
}

/**
 * Intensidad tipica observada por deporte, en TRIMP/min.
 *
 * ⚠️ IMPORTANTE, y viene de un bug encontrado al calibrar. El factor de modalidad NO puede
 * dividir por la intensidad de la sesion concreta, porque entonces la cancela:
 *
 *   factor = MET / (intensidad × C)
 *   carga  = intensidad × factor × volumen = MET/C × volumen
 *
 * La intensidad se va, y el pulso deja de influir en la carga. Comprobado con datos reales:
 * dos carreras con 2,29 y 2,96 de intensidad daban la MISMA carga por minuto.
 *
 * El arreglo: el factor depende del DEPORTE, no de la sesion. La intensidad tipica es una
 * propiedad del deporte, la de la sesion es del esfuerzo de ese dia. Asi el factor sigue
 * corrigiendo la ceguera de la FC ante el trabajo isometrico, y el pulso vuelve a mandar.
 *
 * Valores medidos sobre 46 sesiones reales de 90 dias. Los deportes con menos de 3 sesiones
 * usan la mediana global, y va declarado en `fiable`.
 */
export const INTENSIDAD_TIPICA: Partial<Record<TipoDeporte, number>> = {
  WALKING: 1.0,
  GOLF: 1.13,
  TENNIS: 2.68,
  RUNNING: 2.8,
  STRENGTH_TRAINING: 1.0,
  SPORT: 1.08,
};

/** Mediana global de intensidad observada. Se usa donde no hay muestra por deporte. */
export const INTENSIDAD_GLOBAL = 1.07;

export function intensidadTipica(tipo: string): { valor: number; fiable: boolean } {
  const propia = INTENSIDAD_TIPICA[tipo as TipoDeporte];
  return propia !== undefined
    ? { valor: propia, fiable: true }
    : { valor: INTENSIDAD_GLOBAL, fiable: false };
}

/**
 * Factor de modalidad: cuanto trabajo real no ve la frecuencia cardiaca.
 * Derivado del MET oficial y de la intensidad tipica del deporte, no puesto a mano.
 *
 * Medido: la fuerza observa 1,00 TRIMP/min, o sea 3,4 MET implicitos, cuando la tabla dice
 * 6,0. La FC ve poco mas de la mitad del trabajo. Eso no es una suposicion, es la brecha
 * medida, y de ahi sale el 1,74.
 */
export function factorModalidad(tipo: string): {
  factor: number;
  metOficial: number | null;
  metObservado: number | null;
  limitado: boolean;
  fiable: boolean;
} {
  const metOficial = metDe(tipo);
  if (metOficial === null) {
    return { factor: 1, metOficial: null, metObservado: null, limitado: false, fiable: false };
  }

  const { valor, fiable } = intensidadTipica(tipo);
  const metObservado = valor * MET_POR_TRIMPMIN;
  const bruto = metOficial / metObservado;
  const factor = +Math.max(FACTOR_MIN, Math.min(FACTOR_MAX, bruto)).toFixed(2);

  return {
    factor,
    metOficial,
    metObservado: +metObservado.toFixed(1),
    limitado: bruto > FACTOR_MAX || bruto < FACTOR_MIN,
    fiable,
  };
}
