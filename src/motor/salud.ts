import type { ClaveCiencia } from './ciencia';

/**
 * Métricas diarias de la pulsera, con la banda de más y menos una sigma.
 *
 * ⭐ Recupera el trabajo del panel v2 de la etapa 1, que estaba hecho y aparcado. El mecanismo
 * es el mismo y responde al hallazgo del estudio JAMIA 2023 con 18 usuarios reales de Fitbit: su
 * problema número uno no es estético, es que **no saben qué es normal para ellos mismos**. Un
 * gráfico sin referencia les parecía inútil.
 *
 * ⇒ Cada métrica se compara con TU banda de los últimos 90 días, nunca con una tabla general. Y
 * el color solo aparece cuando el dato sale de la banda.
 *
 * ⚠️⚠️ DIFERENCIA CON `motor-carga/salud.js`, y por eso el port no era mecánico. Aquel leía
 * ficheros JSON del CLI de Google, donde cada data type trae su propio nombre de campo
 * (`averageHeartRateVariabilityMilliseconds`, `beatsPerMinute`, `countSum`...). HealthKit no: da
 * muestras con `quantity` y una unidad, todas con la misma forma. Así que aquí no hay tabla de
 * campos, solo una serie de valores por día.
 *
 * ⛔ Y NADA DE ESTO PUNTÚA. Son informativas, por dos motivos: el HRV no llega de Fitbit ni de
 * WHOOP, así que puntuarlo premiaría tener una marca concreta; y la FDA sancionó a Whoop por una
 * función de bienestar que cruzó a dispositivo médico. La app describe, no diagnostica.
 */

/** Las seis métricas del panel, en el orden en que se muestran. */
export type ClaveMetrica = 'hrv' | 'fcReposo' | 'spo2' | 'respiracion' | 'vo2max' | 'pasos';

export type DefinicionMetrica = {
  clave: ClaveMetrica;
  /** true cuando un valor alto es buena señal. Decide el color al salir de la banda. */
  mejorSubir: boolean;
  decimales: number;
  /** Ficha científica que la explica. */
  ciencia: ClaveCiencia;
  /** ⚠️ true cuando el valor lo calcula un modelo y no lo mide el sensor. Se avisa en pantalla. */
  estimada?: boolean;
};

export const METRICAS: readonly DefinicionMetrica[] = [
  { clave: 'hrv', mejorSubir: true, decimales: 1, ciencia: 'hrv' },
  { clave: 'fcReposo', mejorSubir: false, decimales: 0, ciencia: 'fcReposo' },
  { clave: 'spo2', mejorSubir: true, decimales: 1, ciencia: 'spo2' },
  { clave: 'respiracion', mejorSubir: false, decimales: 1, ciencia: 'respiracion' },
  // El VO2max lo calcula un modelo en la nube, no el sensor. Va declarado.
  { clave: 'vo2max', mejorSubir: true, decimales: 1, ciencia: 'vo2max', estimada: true },
  { clave: 'pasos', mejorSubir: true, decimales: 0, ciencia: 'pasos' },
];

/** Un valor diario ya normalizado. `dia` es fecha local `YYYY-MM-DD`. */
export type Punto = { dia: string; valor: number };

export type Estado = 'dentro' | 'mejor' | 'peor' | 'sin-banda';

export type Metrica =
  | { clave: ClaveMetrica; disponible: false; ciencia: ClaveCiencia }
  | {
      clave: ClaveMetrica;
      disponible: true;
      ciencia: ClaveCiencia;
      mejorSubir: boolean;
      decimales: number;
      estimada: boolean;
      ultimo: number;
      diaUltimo: string;
      estado: Estado;
      /** Banda personal. null cuando no hay días suficientes. */
      media: number | null;
      min: number | null;
      max: number | null;
      /** Días con dato en la ventana, y días de la ventana. */
      diasConDato: number;
      dias: number;
      /** Cambio entre la primera y la segunda mitad. null con pocos días. */
      tendencia: { delta: number; pct: number } | null;
      /** Serie de la ventana, para la línea. */
      serie: readonly Punto[];
    };

/** Días mínimos para que la banda signifique algo. Por debajo, la sigma es ruido. */
export const DIAS_MINIMOS_BANDA = 5;

/** Días mínimos para atreverse a hablar de tendencia. */
export const DIAS_MINIMOS_TENDENCIA = 8;

/** Ventana que se muestra. La banda se calcula sobre todo el histórico disponible. */
export const VENTANA_DIAS = 30;

export type Banda = { media: number; sigma: number; n: number };

/** Media y desviación típica. Es el mismo cálculo que la base de carga, sobre otra serie. */
export function banda(valores: readonly number[]): Banda | null {
  const v = valores.filter((x) => Number.isFinite(x));
  if (v.length < DIAS_MINIMOS_BANDA) return null;

  const media = v.reduce((a, b) => a + b, 0) / v.length;
  const varianza = v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length;
  return { media, sigma: Math.sqrt(varianza), n: v.length };
}

/**
 * Estado de un valor respecto a su banda.
 *
 * ⚠️ `mejorSubir` es imprescindible: en el HRV subir es bueno, en el pulso en reposo es malo. Sin
 * esto la app pintaría de rojo una mejora.
 */
export function estadoDe(valor: number, b: Banda | null, mejorSubir: boolean): Estado {
  if (b === null || b.sigma === 0) return 'sin-banda';

  const z = (valor - b.media) / b.sigma;
  if (Math.abs(z) <= 1) return 'dentro';
  return z > 0 === mejorSubir ? 'mejor' : 'peor';
}

/** Compara la primera mitad de la serie con la segunda. */
export function tendencia(
  serie: readonly Punto[],
): { delta: number; pct: number } | null {
  if (serie.length < DIAS_MINIMOS_TENDENCIA) return null;

  const mitad = Math.floor(serie.length / 2);
  const media = (lista: readonly Punto[]) =>
    lista.reduce((a, p) => a + p.valor, 0) / lista.length;

  const antes = media(serie.slice(0, mitad));
  const ahora = media(serie.slice(mitad));
  if (antes === 0) return null;

  return { delta: ahora - antes, pct: +(((ahora - antes) / antes) * 100).toFixed(1) };
}

/**
 * Una muestra de HealthKit, ya reducida a lo que hace falta.
 *
 * ⚠️ HealthKit puede dar VARIAS muestras del mismo día, y para los pasos son trozos del día que
 * hay que SUMAR, mientras que para el pulso en reposo son lecturas que hay que promediar. Eso lo
 * resuelve `agrupa`, con el modo que le pasa cada métrica.
 */
export type Muestra = { inicio: number; valor: number };

export type Agregacion = 'suma' | 'media' | 'ultimo';

/** Cómo se resume el día en cada métrica. */
export const AGREGACION: Record<ClaveMetrica, Agregacion> = {
  // Los pasos del día llegan repartidos en tramos: hay que sumarlos.
  pasos: 'suma',
  // Estas son lecturas del mismo dato: se promedian.
  hrv: 'media',
  fcReposo: 'media',
  spo2: 'media',
  respiracion: 'media',
  // El VO2max es un valor que se recalcula: vale el último del día.
  vo2max: 'ultimo',
};

function diaLocal(t: number): string {
  const d = new Date(t);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Un valor por día, según el modo de agregación. */
export function agrupa(
  muestras: readonly Muestra[],
  modo: Agregacion,
  decimales: number,
): readonly Punto[] {
  const porDia = new Map<string, number[]>();
  for (const m of muestras) {
    if (!Number.isFinite(m.valor)) continue;
    const dia = diaLocal(m.inicio);
    const lista = porDia.get(dia);
    if (lista === undefined) porDia.set(dia, [m.valor]);
    else lista.push(m.valor);
  }

  return [...porDia.entries()]
    .map(([dia, valores]) => {
      const bruto =
        modo === 'suma'
          ? valores.reduce((a, b) => a + b, 0)
          : modo === 'media'
            ? valores.reduce((a, b) => a + b, 0) / valores.length
            : valores[valores.length - 1];
      return { dia, valor: +bruto.toFixed(decimales) };
    })
    .sort((a, b) => (a.dia < b.dia ? -1 : 1));
}

/**
 * Procesa una métrica.
 *
 * ⚠️ La banda se calcula sobre TODO el histórico y la serie se recorta a la ventana. Es
 * deliberado: con 30 días la sigma se mueve mucho, y la banda es lo que define qué es normal
 * para ti. Mezclar las dos cosas fue un error del panel v1.
 *
 * ⚠️ Un día sin dato NO es un cero, significa que no llevabas la pulsera. Los días ausentes
 * simplemente no están en la serie, nunca entran como 0.
 */
export function procesaMetrica(
  definicion: DefinicionMetrica,
  muestras: readonly Muestra[],
  { dias = VENTANA_DIAS }: { dias?: number } = {},
): Metrica {
  const { clave, ciencia, mejorSubir, decimales } = definicion;
  const todo = agrupa(muestras, AGREGACION[clave], decimales);

  if (todo.length === 0) return { clave, disponible: false, ciencia };

  const serie = todo.slice(-dias);
  const b = banda(todo.map((p) => p.valor));
  const ultimo = serie[serie.length - 1];
  const redondea = (v: number) => +v.toFixed(decimales);

  return {
    clave,
    disponible: true,
    ciencia,
    mejorSubir,
    decimales,
    estimada: definicion.estimada === true,
    ultimo: ultimo.valor,
    diaUltimo: ultimo.dia,
    estado: estadoDe(ultimo.valor, b, mejorSubir),
    media: b === null ? null : redondea(b.media),
    min: b === null ? null : redondea(Math.max(0, b.media - b.sigma)),
    max: b === null ? null : redondea(b.media + b.sigma),
    diasConDato: serie.length,
    dias,
    tendencia:
      tendencia(serie) === null
        ? null
        : { delta: redondea(tendencia(serie)!.delta), pct: tendencia(serie)!.pct },
    serie,
  };
}

/** Todas las métricas de una vez. La entrada es un mapa por clave. */
export function procesaSalud(
  porMetrica: Partial<Record<ClaveMetrica, readonly Muestra[]>>,
  opciones: { dias?: number } = {},
): readonly Metrica[] {
  return METRICAS.map((d) => procesaMetrica(d, porMetrica[d.clave] ?? [], opciones));
}
