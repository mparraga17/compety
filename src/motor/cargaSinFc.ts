import {
  K_VOLUMEN,
  factorModalidad,
  intensidadTipica,
  metDe,
} from './met';

/**
 * Carga de sesiones sin frecuencia cardiaca.
 *
 * Por que existe. La primera version marcaba estas sesiones y no las puntuaba, para no
 * inventar datos. El usuario corrigio, y con razon: sin esto se queda fuera todo el que no
 * lleva pulsera, que es mucha gente. Y hay tres motivos tecnicos que lo agravan: WHOOP solo
 * escribe pulso dentro de entrenos, Garmin recorta valores, y Nike, Strava o Peloton no
 * tienen sensor.
 *
 * Es el mismo error que ya se cometio una vez con el filtro de intensidad minima, que
 * expulsaba el 100 % de las sesiones de fuerza. La leccion fue no castigar a quien la
 * evidencia dice no castigar.
 */

export type OrigenCarga = 'medida' | 'declarada' | 'estimada';

/**
 * Un paso del desglose explicable.
 *
 * ⛔ Antes los pasos eran strings en espanol escritos aqui dentro, y con la app en ingles salian
 * en espanol. Misma regla que costo el bug del `nombre: 'Tú'`: un dato NUNCA lleva texto
 * traducible dentro. Ahora el paso lleva su clave y sus cifras, y la frase la arma la interfaz.
 */
export type Paso = {
  clave:
    | 'intensidadMedida'
    | 'intensidadDeclarada'
    | 'intensidadTipica'
    | 'volumen'
    | 'factorModalidad'
    | 'descuentoSinPulso';
  datos: Record<string, number | string>;
};

export type Carga = {
  valor: number;
  origen: OrigenCarga;
  /** Factor de descuento aplicado. 1 cuando la carga es medida. */
  descuento: number;
  /** Para el desglose explicable que ve el usuario. */
  pasos: readonly Paso[];
  /** true cuando la estimacion se apoya en la mediana global por falta de muestra. */
  aproximado?: boolean;
};

/**
 * ⭐ DESCUENTOS CALIBRADOS contra 46 sesiones reales de 90 dias.
 * Script: FitbitAir/motor-carga/calibraSinFc3.js
 *
 * Metodo: para cada sesion con pulso se calculo su carga real y despues se estimo como si
 * no lo tuviera. La relacion medida/estimada da la desviacion, y de ahi el descuento.
 *
 * Resultado con el factor arreglado: mediana 1,000, error mediano 1 %, percentil 90 del 23 %.
 * O sea que la estimacion acierta en el caso tipico y falla en las colas, que es justo lo
 * que se espera: no ve si ese dia fuiste a tope.
 *
 * Simulacion de cuantas sesiones GANARIAN por no llevar pulsera:
 *
 *   x1,00   9 de 46 (20 %)   penalizacion 0 %
 *   x0,95   4 de 46 ( 9 %)   penalizacion 5 %    ← elegido
 *   x0,90   2 de 46 ( 4 %)   penalizacion 10 %
 *   x0,75   0 de 46 ( 0 %)   penalizacion 25 %
 *
 * ⭐ Se elige 0,95 para la estimacion, y NO el 0,75 que dejaria a cero los casos de ganancia.
 * Razon: el 0,75 castiga al 100 % de la gente sin pulsera para corregir un 9 % de casos, y
 * eso reproduce el error del filtro de intensidad minima. Ademas la mediana ya esta igualada,
 * asi que un descuento grande no corrige un sesgo, crea uno nuevo al reves.
 *
 * El 9 % que gana algo son sesiones suaves: alguien que sale a andar tranquilo y la
 * estimacion le da la intensidad tipica. El coste de eso es pequeno y la alternativa es
 * expulsar a quien no tiene pulsera.
 *
 * ⚠️ Muestra de una sola persona y 90 dias. Hay que revisarlo con datos de varios usuarios.
 */
export const DESCUENTO = {
  /** s-RPE: validez 0,88 contra TRIMP, validado en ballet profesional. */
  declarada: 0.97,
  /** Solo MET, intensidad tipica y duracion: no ve el esfuerzo de ese dia. */
  estimada: 0.95,
  /** Cuando no hay muestra del deporte y se usa la mediana global. Mas incierto. */
  estimadaAproximada: 0.9,
} as const;

export const DESCUENTOS_CALIBRADOS = true;

/**
 * Carga con pulso. Es la via buena: la intensidad la mide el pulso de ESA sesion, y el
 * factor corrige lo que la FC no ve en ese deporte.
 */
export function cargaMedida(entrada: {
  tipo: string;
  minutos: number;
  intensidad: number;
}): Carga {
  const { tipo, minutos, intensidad } = entrada;
  const mod = factorModalidad(tipo);
  const volumen = minutos ** K_VOLUMEN;
  const valor = intensidad * mod.factor * volumen;

  const pasos: Paso[] = [
    { clave: 'intensidadMedida', datos: { intensidad: +intensidad.toFixed(2) } },
  ];
  if (mod.factor !== 1 && mod.metOficial !== null) {
    pasos.push({
      clave: 'factorModalidad',
      datos: {
        factor: mod.factor,
        metObservado: mod.metObservado ?? 0,
        metOficial: mod.metOficial,
      },
    });
  }
  pasos.push({
    clave: 'volumen',
    datos: { minutos: Math.round(minutos), volumen: +volumen.toFixed(1) },
  });

  return { valor: +valor.toFixed(1), origen: 'medida', descuento: 1, pasos };
}

/**
 * Via 2: s-RPE. El usuario dice de 1 a 10 como de dura fue.
 * Es la alternativa reconocida en la literatura cuando no hay pulso, no un parche.
 * Validez 0,88 contra TRIMP, validada en ballet profesional, que es el analogo de barre
 * mas cercano que existe publicado.
 *
 * El RPE de 1 a 10 se traslada a la escala de intensidad del motor, donde 1 es actividad
 * suave y algo menos de 3 es maximo observado.
 */
export function cargaDeclarada(rpe: number, minutos: number, tipo: string): Carga {
  const esfuerzo = Math.max(1, Math.min(10, Math.round(rpe)));
  // De la escala 1-10 a la de TRIMP/min observada, que va de 1 a unos 3.
  const intensidad = 1 + ((esfuerzo - 1) / 9) * 2;
  const mod = factorModalidad(tipo);
  const volumen = minutos ** K_VOLUMEN;
  const valor = intensidad * mod.factor * volumen * DESCUENTO.declarada;

  return {
    valor: +valor.toFixed(1),
    origen: 'declarada',
    descuento: DESCUENTO.declarada,
    pasos: [
      {
        clave: 'intensidadDeclarada',
        datos: { esfuerzo, intensidad: +intensidad.toFixed(2) },
      },
      { clave: 'volumen', datos: { minutos: Math.round(minutos), volumen: +volumen.toFixed(1) } },
      { clave: 'descuentoSinPulso', datos: { descuento: DESCUENTO.declarada } },
    ],
  };
}

/**
 * Via 3: estimar desde el deporte y la duracion. Se usa la intensidad TIPICA observada en
 * ese deporte, que es lo mejor disponible sin pulso.
 *
 * Devuelve null si el deporte no esta en el Compendium: preferimos no puntuar antes que
 * poner un numero sin respaldo.
 */
export function cargaEstimada(tipo: string, minutos: number): Carga | null {
  if (metDe(tipo) === null) return null;

  const { valor: intensidad, fiable } = intensidadTipica(tipo);
  const mod = factorModalidad(tipo);
  const volumen = minutos ** K_VOLUMEN;
  const descuento = fiable ? DESCUENTO.estimada : DESCUENTO.estimadaAproximada;
  const carga = intensidad * mod.factor * volumen * descuento;

  const pasos: readonly Paso[] = [
    {
      clave: 'intensidadTipica',
      datos: { intensidad: +intensidad.toFixed(2), propia: fiable ? 1 : 0 },
    },
    { clave: 'volumen', datos: { minutos: Math.round(minutos), volumen: +volumen.toFixed(1) } },
    { clave: 'descuentoSinPulso', datos: { descuento } },
  ];

  return {
    valor: +carga.toFixed(1),
    origen: 'estimada',
    descuento,
    pasos,
    aproximado: !fiable,
  };
}

/**
 * Elige la mejor via disponible.
 * Orden: pulso medido, luego esfuerzo declarado, luego estimacion por deporte.
 */
export function resuelveCarga(entrada: {
  tipo: string;
  minutos: number;
  intensidad?: number | null;
  rpe?: number | null;
}): Carga | null {
  const { tipo, minutos, intensidad, rpe } = entrada;

  if (intensidad != null && intensidad > 0) {
    return cargaMedida({ tipo, minutos, intensidad });
  }
  // ⚠️ `Number.isFinite` y no solo `!= null`: NaN pasa el chequeo de null y `Math.round(NaN)`
  // dentro de `cargaDeclarada` fabricaria una carga NaN que se propaga hasta los puntos que
  // suben al servidor. Un esfuerzo inutilizable se trata como no declarado y la sesion cae a
  // la estimacion por deporte, que es lo que significa "no hay respuesta". (El guard de
  // intensidad ya rechaza NaN de rebote: `NaN > 0` es false.)
  if (rpe != null && Number.isFinite(rpe)) return cargaDeclarada(rpe, minutos, tipo);

  return cargaEstimada(tipo, minutos);
}

/** Si conviene ofrecer el deslizador de esfuerzo para mejorar la puntuacion. */
export function puedeMejorar(carga: Carga): boolean {
  return carga.origen !== 'medida';
}
