/**
 * Sueño. Portado de `FitbitAir/motor-carga/sueno.js`, con un cambio de forma obligado por
 * HealthKit que se explica abajo.
 *
 * ⭐ El hallazgo que define esta pestaña, y no era el esperado: en UK Biobank la REGULARIDAD de
 * horarios predice la mortalidad mejor que la duración. Dos cohortes independientes, 60.977 y
 * 88.975 personas. Así que el ranking de sueño NO es "quién duerme más".
 *
 * Reparto de los 100 puntos, ya decidido y calibrado contra 40 noches reales:
 * regularidad 45 · eficiencia 30 · duración 25.
 *
 * ⛔ Las fases NO puntúan, y es una decisión con fuente. El consenso de la National Sleep
 * Foundation (panel Delphi RAND/UCLA sobre 277 estudios) acordó que eficiencia, latencia y
 * despertares de más de 5 min sirven como indicadores de calidad, pero NO hubo consenso sobre
 * la arquitectura del sueño ni las siestas. Y las revisiones de wearables dicen que aciertan
 * con el tiempo total y fallan justo al repartir fases. Se muestran como información.
 *
 * ⚠️⚠️ DIFERENCIA REAL CON EL MOTOR ORIGINAL, y es lo único que no es un port mecánico.
 * El CLI de Google devolvía UNA sesión por periodo dormido, con sus minutos por fase ya
 * agregados (`stageMinutes`). HealthKit no: escribe MUCHAS muestras de categoría, una por
 * tramo, cada una con un valor (en cama, despierto, ligero, profundo, REM). Una noche son
 * decenas de tramos.
 *
 * ⇒ Hay un paso previo que en el original no existía: agrupar tramos contiguos en sesiones.
 * El resto de la lógica (noche frente a siesta, fecha de despertar, regularidad circular) se
 * conserva tal cual, porque ya estaba resuelta y probada.
 */

/**
 * Valores de `HKCategoryValueSleepAnalysis`.
 *
 * ⚠️ Escritos como constantes locales A PROPÓSITO, no importados del enum de la librería. Dos
 * motivos, los dos medidos en este proyecto:
 *   1. Al mockear la librería en los tests los enums quedan `undefined`, así que un test que
 *      los use en silencio no prueba nada. Es el patrón que ya documentó SparkyFitness.
 *   2. Son valores de la API de Apple, estables por contrato. Fijarlos aquí permite testear
 *      el motor entero en Windows sin HealthKit.
 */
export const FASE = {
  enCama: 0,
  dormidoSinDetalle: 1,
  despierto: 2,
  ligero: 3,
  profundo: 4,
  rem: 5,
} as const;

/** Valores que cuentan como tiempo dormido de verdad. */
const DORMIDO: readonly number[] = [
  FASE.dormidoSinDetalle,
  FASE.ligero,
  FASE.profundo,
  FASE.rem,
];

/** Umbrales, todos con fuente. Ninguno inventado. */
export const OBJETIVO_HORAS = 7;
export const EFICIENCIA_BUENA = 85;

/** Por encima de 2 h dormidas ya no es una siesta. */
export const SIESTA_MAX_MIN = 120;

/**
 * Hueco que separa dos periodos de sueño distintos.
 *
 * Los tramos de una misma noche llegan pegados o con minutos de diferencia. Un hueco largo
 * significa que te levantaste, así que empieza otro periodo. 60 min es conservador: parte
 * noche y siesta sin trocear una noche con despertares.
 */
export const HUECO_ENTRE_PERIODOS_MIN = 60;

/** Noches mínimas para que la regularidad signifique algo. */
export const NOCHES_MINIMAS = 3;

/** Reparto de los 100 puntos. Decidido y calibrado, no se vuelve a discutir. */
export const PESOS = { regularidad: 45, eficiencia: 30, duracion: 25 } as const;

/** Un tramo de sueño tal como llega de HealthKit. */
export type TramoSueno = {
  inicio: number;
  fin: number;
  /** Valor de `FASE`. */
  valor: number;
  fuente?: string;
};

export type Periodo = {
  inicio: number;
  fin: number;
  /** Fecha de DESPERTAR en formato local `YYYY-MM-DD`. */
  fecha: string;
  /** Minutos desde medianoche, para medir regularidad. */
  horaAcostarse: number;
  horaLevantarse: number;
  dormidoMinutos: number;
  despiertoMinutos: number;
  /** Tiempo en cama declarado por la fuente. null si no lo escribe. */
  enCamaMinutos: number | null;
  /** dormido / tiempo en cama, en porcentaje. null si no se puede medir. */
  eficiencia: number | null;
  fases: { ligero: number; profundo: number; rem: number };
  /** true si la fuente reparte fases. Sin esto solo hay tiempo total. */
  conFases: boolean;
  esSiesta: boolean;
  fuentes: readonly string[];
};

export type Dia = {
  fecha: string;
  noche: Periodo;
  siestas: readonly Periodo[];
  siestaMinutos: number;
  /** Noche más siestas. */
  totalDormido: number;
};

const minutos = (ms: number) => ms / 60_000;

/** Fecha local `YYYY-MM-DD`. Local y no UTC: la noche pertenece al día que esa persona vivió. */
function fechaLocal(t: number): string {
  const d = new Date(t);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function formateaHora(mins: number): string {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Agrupa tramos sueltos en periodos de sueño.
 *
 * Es el paso que no existía en el motor original, porque el CLI ya daba sesiones agregadas.
 * Dos tramos van al mismo periodo si el hueco entre ellos es menor que el umbral.
 *
 * ⚠️ Los tramos NO llegan ordenados ni sin solapes: si dos fuentes escriben la misma noche
 * (la pulsera y el iPhone, por ejemplo) hay solape. Por eso el tiempo dormido se mide sobre
 * la UNIÓN de intervalos y no sumando duraciones, que contaría doble.
 */
export function agrupaEnPeriodos(
  tramos: readonly TramoSueno[],
  huecoMin = HUECO_ENTRE_PERIODOS_MIN,
): readonly Periodo[] {
  const validos = tramos
    .filter((t) => t.fin > t.inicio)
    .sort((a, b) => a.inicio - b.inicio);
  if (validos.length === 0) return [];

  const grupos: TramoSueno[][] = [[validos[0]]];
  let finGrupo = validos[0].fin;

  for (let i = 1; i < validos.length; i++) {
    const t = validos[i];
    if (minutos(t.inicio - finGrupo) > huecoMin) grupos.push([t]);
    else grupos[grupos.length - 1].push(t);
    finGrupo = Math.max(finGrupo, t.fin);
  }

  return grupos.map(construyePeriodo);
}

/**
 * Minutos que cubre un conjunto de intervalos, contando el solape una sola vez.
 * Sumar duraciones daría noches de 12 h cuando dos fuentes escriben la misma.
 */
function minutosDeUnion(tramos: readonly TramoSueno[]): number {
  if (tramos.length === 0) return 0;

  const orden = [...tramos].sort((a, b) => a.inicio - b.inicio);
  let total = 0;
  let desde = orden[0].inicio;
  let hasta = orden[0].fin;

  for (let i = 1; i < orden.length; i++) {
    if (orden[i].inicio > hasta) {
      total += hasta - desde;
      desde = orden[i].inicio;
      hasta = orden[i].fin;
    } else if (orden[i].fin > hasta) {
      hasta = orden[i].fin;
    }
  }
  return minutos(total + (hasta - desde));
}

function construyePeriodo(tramos: readonly TramoSueno[]): Periodo {
  const inicio = Math.min(...tramos.map((t) => t.inicio));
  const fin = Math.max(...tramos.map((t) => t.fin));

  const de = (valores: readonly number[]) =>
    minutosDeUnion(tramos.filter((t) => valores.includes(t.valor)));

  const dormidoMinutos = de(DORMIDO);
  const despiertoMinutos = de([FASE.despierto]);
  const enCama = de([FASE.enCama]);

  const ini = new Date(inicio);
  const finD = new Date(fin);

  // ⚠️ Eficiencia = dormido / tiempo en cama, que es la definición estándar. Pero muchas
  // fuentes (Fitbit entre ellas) NO escriben tramos `inBed`, solo fases. Sin tiempo en cama
  // se aproxima con la ventana total del periodo, que incluye los despertares. Y si no hay
  // ni eso, se devuelve null en vez de inventar un 100 %.
  const enCamaMinutos = enCama > 0 ? +enCama.toFixed(1) : null;
  const referencia = enCama > 0 ? enCama : minutos(fin - inicio);
  const eficiencia =
    referencia > 0 ? +Math.min(100, (dormidoMinutos / referencia) * 100).toFixed(1) : null;

  const fases = {
    ligero: +de([FASE.ligero]).toFixed(1),
    profundo: +de([FASE.profundo]).toFixed(1),
    rem: +de([FASE.rem]).toFixed(1),
  };

  return {
    inicio,
    fin,
    // Fecha de DESPERTAR: una noche que empieza el 25 a las 02:08 es la noche del 26.
    // Criterio ya establecido en el panel v2, se conserva.
    fecha: fechaLocal(fin),
    horaAcostarse: ini.getHours() * 60 + ini.getMinutes(),
    horaLevantarse: finD.getHours() * 60 + finD.getMinutes(),
    dormidoMinutos: +dormidoMinutos.toFixed(1),
    despiertoMinutos: +despiertoMinutos.toFixed(1),
    enCamaMinutos,
    eficiencia,
    fases,
    conFases: fases.ligero + fases.profundo + fases.rem > 0,
    esSiesta: dormidoMinutos <= SIESTA_MAX_MIN,
    fuentes: [...new Set(tramos.map((t) => t.fuente).filter((f): f is string => f != null))],
  };
}

/**
 * Agrupa periodos por día: la más larga es la noche, el resto son siestas.
 *
 * ⚠️ Esta regla ya costó un bug en el panel: la primera versión se quedaba con la última
 * sesión procesada, así que una siesta de 40 min sustituía una noche de 7 h. Se conserva
 * exactamente igual.
 */
export function agrupaPorDia(periodos: readonly Periodo[]): readonly Dia[] {
  const dias = new Map<string, Periodo[]>();
  for (const p of periodos) {
    const lista = dias.get(p.fecha);
    if (lista === undefined) dias.set(p.fecha, [p]);
    else lista.push(p);
  }

  return [...dias.entries()]
    .map(([fecha, lista]) => {
      const orden = [...lista].sort((a, b) => b.dormidoMinutos - a.dormidoMinutos);
      const siestas = orden.slice(1);
      return {
        fecha,
        noche: orden[0],
        siestas,
        siestaMinutos: +siestas.reduce((a, s) => a + s.dormidoMinutos, 0).toFixed(1),
        totalDormido: +orden.reduce((a, s) => a + s.dormidoMinutos, 0).toFixed(1),
      };
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

export type Regularidad =
  | { disponible: false; noches: number; minimo: number }
  | {
      disponible: true;
      /** 0 a 100. Más alto es más regular. */
      indice: number;
      /** ⚠️ Siempre true: no es el SRI validado del paper, ver abajo. */
      aproximado: true;
      sdAcostarseMin: number;
      sdLevantarseMin: number;
      horaTipicaAcostarse: string;
      horaTipicaLevantarse: string;
      noches: number;
    };

/**
 * Estadística circular de horas del día.
 *
 * ⭐ Circular y no aritmética, y esto importa de verdad: acostarse a las 23:50 y a las 00:10
 * son 20 min de diferencia, no 23 horas y 40. Una media normal daría 11:00 de hora típica,
 * que es justo la mitad del día equivocada.
 */
function circular(mins: readonly number[]): { media: number; sd: number } {
  const rad = mins.map((m) => (m / 1440) * 2 * Math.PI);
  const sx = rad.reduce((a, r) => a + Math.sin(r), 0) / rad.length;
  const cx = rad.reduce((a, r) => a + Math.cos(r), 0) / rad.length;
  const R = Math.sqrt(sx * sx + cx * cx);

  return {
    media: ((Math.atan2(sx, cx) / (2 * Math.PI)) * 1440 + 1440) % 1440,
    // Desviación circular convertida a minutos.
    sd: Math.sqrt(-2 * Math.log(Math.max(R, 1e-9))) * (1440 / (2 * Math.PI)),
  };
}

/** Desviación a la que el índice llega a 0. Escala declarada, no del paper. */
const SD_PEOR_CASO = 120;

/**
 * Regularidad de horarios. Es la métrica que más pesa.
 *
 * ⚠️ LÍMITE DECLARADO, y va marcado en el resultado con `aproximado`. El SRI del paper
 * necesita acelerometría minuto a minuto, que no tenemos. Lo que se calcula es la desviación
 * circular de las horas de acostarse y levantarse, que es lo que sí da HealthKit. Es una
 * aproximación razonable del mismo concepto, no la métrica validada.
 */
export function calculaRegularidad(dias: readonly Dia[]): Regularidad {
  if (dias.length < NOCHES_MINIMAS) {
    return { disponible: false, noches: dias.length, minimo: NOCHES_MINIMAS };
  }

  const acostarse = circular(dias.map((d) => d.noche.horaAcostarse));
  const levantarse = circular(dias.map((d) => d.noche.horaLevantarse));
  const sdMedia = (acostarse.sd + levantarse.sd) / 2;

  return {
    disponible: true,
    indice: Math.max(0, Math.min(100, Math.round(100 - (sdMedia / SD_PEOR_CASO) * 100))),
    aproximado: true,
    sdAcostarseMin: Math.round(acostarse.sd),
    sdLevantarseMin: Math.round(levantarse.sd),
    horaTipicaAcostarse: formateaHora(acostarse.media),
    horaTipicaLevantarse: formateaHora(levantarse.media),
    noches: dias.length,
  };
}

export type ClaveCienciaSueno =
  | 'regularidad'
  | 'regularidad2'
  | 'eficienciaSueno'
  | 'duracion'
  | 'fasesSinConsenso'
  | 'precisionSueno';

export type Componente = {
  clave: 'regularidad' | 'eficiencia' | 'duracion';
  valor: number;
  maximo: number;
  /**
   * Cifras del componente, SIN texto.
   *
   * ⛔ Antes esto era una `formula: string` escrita en español dentro del motor, y era el mismo
   * bug que el `nombre: 'Tú'` del `build.js`: un dato con texto traducible dentro no puede
   * cambiar de idioma. La frase la arma la interfaz con estos valores.
   */
  datos: Record<string, number | string>;
  ciencia: ClaveCienciaSueno;
};

export type Fases = {
  profundoPct: number;
  remPct: number;
  noches: number;
  /** Siempre false. Va explícito porque es una decisión de producto con fuente. */
  puntua: false;
};

export type ResumenSueno =
  | { disponible: false; noches: 0 }
  | {
      disponible: true;
      /** Sobre 100. */
      puntos: number;
      componentes: readonly Componente[];
      mediaHoras: number;
      eficienciaMedia: number | null;
      nochesCortas: number;
      noches: number;
      siestas: number;
      fases: Fases | null;
      regularidad: Regularidad;
    };

/**
 * Puntuación de sueño sobre 100. Tres componentes, cada uno con su fuente.
 *
 * Las dos correcciones que salieron al probar con 40 noches reales están dentro y son las que
 * hacen que la cifra signifique algo. Sin ellas la puntuación salía casi siempre al máximo.
 */
export function puntuaSueno(dias: readonly Dia[]): ResumenSueno {
  if (dias.length === 0) return { disponible: false, noches: 0 };

  const regularidad = calculaRegularidad(dias);

  // 1. Regularidad, el predictor más fuerte de los tres.
  const pReg = regularidad.disponible
    ? Math.round((regularidad.indice / 100) * PESOS.regularidad)
    : 0;

  // 2. Eficiencia.
  // ⚠️ Reescalada en 85-100 %, no en 0-100. Medido con datos reales: la mediana sale al 96 % y
  // solo 3 de 40 noches bajan del 85 % clínico, porque la pulsera cuenta tiempo dormido y no
  // tiempo en la cama. Con la escala completa el indicador satura y no distingue una noche
  // buena de una mala. Entre 85 y 100 sí hay señal.
  // Y la latencia, que el consenso NSF también valida, llega siempre a 0 ⇒ no está disponible.
  const efs = dias.map((d) => d.noche.eficiencia).filter((v): v is number => v != null);
  const efMedia = efs.length > 0 ? efs.reduce((a, b) => a + b, 0) / efs.length : null;
  const efNorm =
    efMedia === null
      ? 0
      : Math.max(0, Math.min(1, (efMedia - EFICIENCIA_BUENA) / (100 - EFICIENCIA_BUENA)));
  const pEf = Math.round(efNorm * PESOS.eficiencia);
  const despiertoMedia = dias.reduce((a, d) => a + d.noche.despiertoMinutos, 0) / dias.length;

  // 3. Duración: PROPORCIÓN de noches que llegan al objetivo, no la media.
  // ⚠️ Motivo medido: 7,1 h de media daba el máximo aunque 8 de 15 noches estuvieran por
  // debajo de 7 h. La media esconde las noches malas, y el paper habla de sueño corto
  // SOSTENIDO, no de promedios. Contar noches es más fiel a lo que mide la literatura.
  const horas = dias.map((d) => d.totalDormido / 60);
  const hMedia = horas.reduce((a, b) => a + b, 0) / horas.length;
  const cumplidas = horas.filter((h) => h >= OBJETIVO_HORAS).length;
  const pDur = Math.round((cumplidas / horas.length) * PESOS.duracion);

  const componentes: readonly Componente[] = [
    {
      clave: 'regularidad',
      valor: pReg,
      maximo: PESOS.regularidad,
      datos: regularidad.disponible
        ? {
            acostarse: regularidad.horaTipicaAcostarse,
            variacionAcostarse: regularidad.sdAcostarseMin,
            levantarse: regularidad.horaTipicaLevantarse,
            variacionLevantarse: regularidad.sdLevantarseMin,
          }
        : { minimo: NOCHES_MINIMAS },
      ciencia: 'regularidad',
    },
    {
      clave: 'eficiencia',
      valor: pEf,
      maximo: PESOS.eficiencia,
      datos:
        efMedia === null
          ? {}
          : { porcentaje: +efMedia.toFixed(1), despierto: Math.round(despiertoMedia) },
      ciencia: 'eficienciaSueno',
    },
    {
      clave: 'duracion',
      valor: pDur,
      maximo: PESOS.duracion,
      datos: {
        cumplidas,
        total: horas.length,
        objetivo: OBJETIVO_HORAS,
        media: +hMedia.toFixed(1),
      },
      ciencia: 'duracion',
    },
  ];

  // Fases: se informan pero NO puntúan, por falta de consenso científico.
  const conFases = dias.filter((d) => d.noche.conFases);
  const dormidoConFases = conFases.reduce((a, d) => a + d.noche.dormidoMinutos, 0);
  const fases: Fases | null =
    conFases.length > 0 && dormidoConFases > 0
      ? {
          profundoPct: +(
            (conFases.reduce((a, d) => a + d.noche.fases.profundo, 0) / dormidoConFases) *
            100
          ).toFixed(1),
          remPct: +(
            (conFases.reduce((a, d) => a + d.noche.fases.rem, 0) / dormidoConFases) *
            100
          ).toFixed(1),
          noches: conFases.length,
          puntua: false,
        }
      : null;

  return {
    disponible: true,
    puntos: pReg + pEf + pDur,
    componentes,
    mediaHoras: +hMedia.toFixed(1),
    eficienciaMedia: efMedia === null ? null : +efMedia.toFixed(1),
    nochesCortas: horas.length - cumplidas,
    noches: dias.length,
    siestas: dias.reduce((a, d) => a + d.siestas.length, 0),
    fases,
    regularidad,
  };
}

export type Sueno = {
  dias: readonly Dia[];
  /** Solo los días de la ventana analizada. Es sobre estos que se puntúa. */
  ventana: readonly Dia[];
  resumen: ResumenSueno;
};

/** Días que se analizan por defecto. Suficiente para que la regularidad signifique algo. */
export const VENTANA_DIAS = 14;

/** Punto de entrada: de tramos de HealthKit a puntuación. */
export function procesaSueno(
  tramos: readonly TramoSueno[],
  { ventana = VENTANA_DIAS }: { ventana?: number } = {},
): Sueno {
  const dias = agrupaPorDia(agrupaEnPeriodos(tramos));

  // La ventana se cuenta desde la última noche con datos, no desde hoy: si dejaste la pulsera
  // tres días, sigue habiendo algo que mostrar en vez de una pantalla vacía.
  const corte =
    dias.length > 0 ? new Date(dias[0].fecha).getTime() - (ventana - 1) * 86_400_000 : 0;
  const recientes = dias.filter((d) => new Date(d.fecha).getTime() >= corte);

  return { dias, ventana: recientes, resumen: puntuaSueno(recientes) };
}
