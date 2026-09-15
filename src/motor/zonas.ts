/**
 * Zonas de frecuencia cardiaca calculadas desde los pulsos crudos.
 *
 * Por que se calculan aqui y no se leen: HealthKit NO expone las zonas de FC como dato.
 * Lo confirma un ingeniero de Apple en sus foros.
 * https://developer.apple.com/forums/thread/718549
 *
 * Es buena noticia: controlamos la formula, que es justo el diferencial del producto.
 */

/**
 * El maximo de referencia sale del percentil 99 de la FC observada, no de `220 - edad`.
 *
 * Dos motivos, los dos con fuente. Esa formula sale de estudios con hombres y esta sesgada
 * para mujeres, que son el nicho principal (Gulati propone 206 - 0,88 x edad). Y ninguna
 * formula acierta a nivel individual.
 *
 * ⚠️ PERO el percentil solo vale si hay historico suficiente. Medido en un iPhone real el
 * 28 ago: con datos de una semana el percentil 99 dio 109,88 lpm, que es imposible como
 * maximo. Con un maximo tan bajo casi todo cae en zona alta y las intensidades se inflan:
 * una sesion de 29 min y otra de 260 daban la misma intensidad, 3,52 y 3,53.
 *
 * ⇒ Se aplica un SUELO. Por debajo de el, el percentil no es creible y se usa la referencia
 * minima. Y se declara que el maximo es provisional, para poder avisar en la interfaz.
 */

/**
 * Suelo del maximo. 160 lpm es conservador: por debajo de eso, un percentil 99 significa
 * que la persona no ha hecho esfuerzo intenso en el periodo, no que su maximo sea ese.
 */
export const MAXIMO_MINIMO = 160;

/** Muestras minimas para que el percentil signifique algo. */
export const MUESTRAS_MINIMAS = 500;

export type MaximoReferencia = {
  valor: number;
  /** true cuando no hay historico suficiente o el percentil cayo por debajo del suelo. */
  provisional: boolean;
  observado: number | null;
  muestras: number;
};

export function maximoDeReferencia(pulsos: readonly number[]): MaximoReferencia {
  if (pulsos.length === 0) {
    return { valor: MAXIMO_MINIMO, provisional: true, observado: null, muestras: 0 };
  }

  const s = [...pulsos].sort((a, b) => a - b);
  const observado = +s[Math.min(s.length - 1, Math.floor(s.length * 0.99))].toFixed(0);

  const creible = pulsos.length >= MUESTRAS_MINIMAS && observado >= MAXIMO_MINIMO;

  return {
    valor: creible ? observado : Math.max(observado, MAXIMO_MINIMO),
    provisional: !creible,
    observado,
    muestras: pulsos.length,
  };
}

/** @deprecated usar maximoDeReferencia, que declara si el maximo es provisional. */
export function maximoObservado(pulsos: readonly number[]): number | null {
  const m = maximoDeReferencia(pulsos);
  return m.provisional ? null : m.valor;
}

/**
 * Cuatro zonas, como las que da Fitbit. El Edwards original usa cinco, pero con cuatro se
 * mantiene la proporcion de pesos y encaja con lo que ya estaba calibrado.
 */
export const LIMITES = [0.5, 0.6, 0.7, 0.85] as const;
export const PESOS = [1, 2, 3, 4] as const;

export type Zonas = {
  /** Segundos en cada zona, de suave a maxima. */
  segundos: readonly [number, number, number, number];
  /** Edwards TRIMP: suma de minutos por zona multiplicados por el numero de zona. */
  trimp: number;
  /** TRIMP por minuto en zona. Es lo que separa deportes: tenis 2,8 y golf 1,1. */
  intensidad: number | null;
  maximoUsado: number;
};

type Muestra = { valor: number; inicio: Date; fin: Date };

/**
 * ⭐ Resumen de los pulsos de una sesion, INDEPENDIENTE del maximo de referencia.
 *
 * Existe para poder guardarlo: leer los pulsos de HealthKit es lo caro del motor (dos consultas
 * por sesion), y con un año de historial son cientos. Guardar las zonas ya calculadas no vale,
 * porque el maximo de referencia se recalcula cada semana y las dejaria obsoletas. Lo que si es
 * estable es CUANTO tiempo se paso a cada pulso: con eso, las zonas para cualquier maximo salen
 * en un bucle sobre ~100 entradas. `n` y `suma` son para la media, que no depende del reparto.
 *
 * ⚠️ El pulso se redondea al entero (1 lpm). Fitbit ya escribe enteros; si una fuente escribe
 * decimales, la zona solo podria cambiar en un valor que caiga a menos de 0,5 lpm de un limite.
 */
export type ResumenPulsos = {
  /** Numero de muestras. */
  n: number;
  /** Suma de los valores, para la media. */
  suma: number;
  /** Pares [lpm, segundos]: cuanto tiempo se paso a ese pulso. Orden libre. */
  hist: readonly (readonly [number, number])[];
};

export const RESUMEN_VACIO: ResumenPulsos = { n: 0, suma: 0, hist: [] };

/**
 * De las muestras crudas al resumen.
 *
 * Cada muestra cubre el intervalo que va hasta la siguiente, con un tope para no inflar
 * huecos: si la pulsera dejo de medir 20 min, esos 20 min no cuentan como esfuerzo.
 * Con el hueco de 1 min medido en la practica, el tope apenas actua.
 */
export function resumenDePulsos(
  muestras: readonly Muestra[],
  { huecoMaximoSegundos = 120 } = {},
): ResumenPulsos {
  const porLpm = new Map<number, number>();
  let suma = 0;

  for (let i = 0; i < muestras.length; i++) {
    const actual = muestras[i];
    const siguiente = muestras[i + 1];
    suma += actual.valor;

    const bruto = siguiente
      ? (siguiente.inicio.getTime() - actual.inicio.getTime()) / 1000
      : (actual.fin.getTime() - actual.inicio.getTime()) / 1000;

    const duracion = Math.min(Math.max(bruto, 0), huecoMaximoSegundos);
    if (duracion === 0) continue;

    const lpm = Math.round(actual.valor);
    porLpm.set(lpm, (porLpm.get(lpm) ?? 0) + duracion);
  }

  return { n: muestras.length, suma, hist: [...porLpm.entries()] };
}

/** Media de pulso del resumen, redondeada. null sin muestras. */
export function fcMediaDe(resumen: ResumenPulsos): number | null {
  return resumen.n === 0 ? null : Math.round(resumen.suma / resumen.n);
}

/** Reparte el tiempo de la sesion entre zonas, a partir del resumen y del maximo de hoy. */
export function zonasDeResumen(resumen: ResumenPulsos, maximo: number): Zonas | null {
  if (resumen.n < 2 || maximo <= 0) return null;

  const segundos: [number, number, number, number] = [0, 0, 0, 0];

  for (const [lpm, duracion] of resumen.hist) {
    const fraccion = lpm / maximo;
    // Por debajo del 50 % no cuenta como esfuerzo.
    if (fraccion < LIMITES[0]) continue;

    let zona = 0;
    for (let z = LIMITES.length - 1; z >= 0; z--) {
      if (fraccion >= LIMITES[z]) {
        zona = z;
        break;
      }
    }
    segundos[zona] += duracion;
  }

  const totalSegundos = segundos.reduce((a, b) => a + b, 0);
  const trimp = segundos.reduce((acc, seg, i) => acc + (seg / 60) * PESOS[i], 0);

  return {
    segundos,
    trimp: +trimp.toFixed(1),
    intensidad: totalSegundos > 0 ? +(trimp / (totalSegundos / 60)).toFixed(2) : null,
    maximoUsado: maximo,
  };
}

/** Zonas directamente desde las muestras. Es `zonasDeResumen(resumenDePulsos(...))`: un solo camino. */
export function calculaZonas(
  muestras: readonly Muestra[],
  maximo: number,
  opciones: { huecoMaximoSegundos?: number } = {},
): Zonas | null {
  return zonasDeResumen(resumenDePulsos(muestras, opciones), maximo);
}
