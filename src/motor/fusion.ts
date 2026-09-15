/**
 * Fusion de sesiones duplicadas entre fuentes.
 *
 * ⭐ Hallazgo que la hace obligatoria desde el dia uno, no un parche posterior. En 90 dias de
 * datos reales, 11 de 15 carreras las registro Nike Run Club y no la pulsera, y 5 estaban
 * DUPLICADAS solapando al 98-100 % con una sesion de la pulsera. Sin deduplicar, esas carreras
 * contaban dos veces.
 *
 * Cobertura medida por fuente, que es lo que fija las reglas:
 *
 *   campo          pulsera        Nike
 *   FC y zonas     100 % / 98 %   0 %
 *   pasos          84 %           0 %
 *   ritmo y km     56 % / 87 %    100 %
 *
 * ⇒ No se descarta ninguna fuente, se fusionan campo a campo. La pulsera aporta corazon, la
 * app de GPS aporta ritmo y distancia. En HealthKit pasa lo mismo, porque Nike, Strava,
 * Peloton y la pulsera escriben a la vez.
 *
 * Dos detalles que costaron un bug cada uno y estan resueltos abajo:
 *   la fusion es N:1, no par a par (Nike partio una carrera en dos que la pulsera vio entera)
 *   la distancia se toma como maximo, no de la fuente preferida
 */

/** Marcas que miden el pulso con sensor propio. */
const PATRON_WEARABLE = /fitbit|garmin|whoop|apple\s*watch|oura|polar|coros|suunto/i;

export function esWearable(fuente: string | null | undefined): boolean {
  return PATRON_WEARABLE.test(fuente ?? '');
}

/** Sesion normalizada, ya independiente de HealthKit. */
export type SesionCruda = {
  id: string;
  tipo: string | null;
  fuente: string;
  inicio: number;
  fin: number;
  /** Duracion activa en segundos. */
  segundos: number;
  /** Pulsos crudos de la sesion, si los hay. */
  pulsos: readonly { valor: number; inicio: Date; fin: Date }[];
  metros?: number | null;
  pasos?: number | null;
  kcal?: number | null;
  /** Segundos por metro. */
  ritmo?: number | null;
  /**
   * true si la persona TECLEO el entreno en la app Salud (`HKWasUserEntered`), en vez de
   * grabarlo un dispositivo o una app. Un entreno a mano no tiene frecuencia cardiaca propia:
   * lo que haya en ese rango de horas lo midio otra cosa, no ese entreno.
   */
  manual?: boolean;
};

export type SesionFusionada = SesionCruda & {
  fuentes: readonly string[];
  fusionada: boolean;
  /** Ids originales que se unieron. Sirve para no notificar dos veces lo mismo. */
  ids: readonly string[];
  /** true solo si TODO lo que se fusiono era a mano. Con un registro automatico dentro, false. */
  manual: boolean;
};

/** Solape minimo respecto a la sesion mas corta para considerarlas la misma. */
export const UMBRAL_SOLAPE = 0.5;

/**
 * ⭐ Tipos que NO son un deporte sino "no se que deporte era": null (codigo desconocido) y
 * 'SPORT' (el "otro" de HealthKit, codigo 3000, donde el puente de Fitbit tira las pesas).
 *
 * ⛔ Aqui habia un escape medido en el propio proyecto: Fitbit escribia las pesas como 3000 →
 * 'SPORT' y un Apple Watch las escribe como 50 → 'STRENGTH_TRAINING'. Mismo entreno, tipos
 * distintos, y la regla exigia tipo identico: no se agrupaban y contaban DOS veces, en el ranking
 * y en la base personal. La correccion manual del deporte llega despues de deduplicar, asi que
 * tampoco lo reparaba. Un generico no puede vetar un solape del 90 %: es lo que significa.
 *
 * ⚠️ Solo estos dos. 'WORKOUT' agrupa varias actividades de HealthKit pero es una familia real
 * (eliptica, escaleras, cross training); tratarlo como generico se decidira con datos, no aqui.
 */
export function esTipoGenerico(tipo: string | null): boolean {
  return tipo === null || tipo === 'SPORT';
}

/** Dos tipos pueden ser el mismo entreno si coinciden o si alguno no sabe que deporte era. */
function tiposCompatibles(a: string | null, b: string | null): boolean {
  return a === b || esTipoGenerico(a) || esTipoGenerico(b);
}

/**
 * Agrupa sesiones que son la misma cosa vista por fuentes distintas.
 *
 * Dos registros van juntos si su tipo es compatible (igual, o uno de los dos generico) y se
 * solapan por encima del umbral respecto al mas corto. Los grupos son transitivos, con
 * union-find, y eso es lo que cubre el caso N:1: si Nike partio una carrera en dos y la pulsera
 * la vio entera, comparar por pares dejaria uno de los trozos suelto.
 *
 * ⚠️ El solape es la guarda real contra falsos positivos: dos deportes de verdad distintos no
 * pueden ocupar la misma media hora de la misma persona. Por eso relajar el tipo cuando uno es
 * generico es seguro, y por eso dos deportes CONCRETOS distintos siguen sin mezclarse.
 */
export function agrupa(
  sesiones: readonly SesionCruda[],
  umbral = UMBRAL_SOLAPE,
): readonly SesionCruda[][] {
  const orden = [...sesiones].sort((a, b) => a.inicio - b.inicio);
  const padre = orden.map((_, i) => i);

  const raiz = (i: number): number => {
    while (padre[i] !== i) {
      padre[i] = padre[padre[i]];
      i = padre[i];
    }
    return i;
  };
  const une = (a: number, b: number) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre[rb] = ra;
  };

  for (let i = 0; i < orden.length; i++) {
    for (let j = i + 1; j < orden.length; j++) {
      // Estan ordenadas por inicio, asi que a partir de aqui ya no solapa nada con i.
      if (orden[j].inicio >= orden[i].fin) break;
      if (!tiposCompatibles(orden[i].tipo, orden[j].tipo)) continue;

      const solape =
        Math.min(orden[i].fin, orden[j].fin) - Math.max(orden[i].inicio, orden[j].inicio);
      const corta = Math.min(orden[i].fin - orden[i].inicio, orden[j].fin - orden[j].inicio);
      if (corta > 0 && solape / corta >= umbral) une(i, j);
    }
  }

  const grupos = new Map<number, SesionCruda[]>();
  orden.forEach((s, i) => {
    const r = raiz(i);
    const lista = grupos.get(r);
    if (lista) lista.push(s);
    else grupos.set(r, [s]);
  });

  return [...grupos.values()];
}

/**
 * El deporte del grupo: el CONCRETO, nunca el generico si hay otro.
 *
 * Antes salia del corazon por el `...corazon`, y el corazon es el wearable: en el caso
 * Fitbit + Watch eso devolvia justo el 'SPORT' de Fitbit. El MET, el descuento sin pulso y la
 * liga salen del tipo, asi que tiene que ser el que sabe que deporte fue. Si hay varios concretos
 * (un generico hizo de puente entre dos registros mal etiquetados), gana el de la sesion mas
 * larga: es la que vio el entreno entero. Nunca se inventa un tercero.
 */
function tipoDelGrupo(grupo: readonly SesionCruda[]): string | null {
  const concretas = grupo.filter((s) => !esTipoGenerico(s.tipo));
  if (concretas.length === 0) return grupo[0].tipo;
  return concretas.reduce((mejor, s) => (s.fin - s.inicio > mejor.fin - mejor.inicio ? s : mejor)).tipo;
}

/**
 * Une un grupo en una sesion: cada campo lo aporta quien lo mide mejor.
 *
 * ⛔ REGLA DE LOS ENTRENOS A MANO (decision de producto, 15 sep): un entreno tecleado en Salud
 * cuenta SOLO cuando ningun dispositivo ni app grabo ese rato. Si hay un registro automatico en
 * el grupo, el manual no aporta ningun campo: ni alarga la duracion, ni sube la distancia, ni
 * cambia el tipo. Sin esta regla, teclear "3 h de carrera" encima de una carrera real de 45 min
 * la fusionaba (mismo tipo) y `segundos = max` la convertia en una sesion de 3 h con la
 * intensidad REAL del pulso: el camino mas barato para inflar la puntuacion. El manual deja su
 * id en `ids` (para no volver a tratarlo) y su fuente en `fuentes` (para que se vea).
 */
export function fusiona(grupo: readonly SesionCruda[]): SesionFusionada {
  if (grupo.length === 1) {
    return {
      ...grupo[0],
      fuentes: [grupo[0].fuente],
      fusionada: false,
      ids: [grupo[0].id],
      manual: grupo[0].manual === true,
    };
  }

  const automaticas = grupo.filter((s) => s.manual !== true);
  if (automaticas.length > 0 && automaticas.length < grupo.length) {
    // Hay registro automatico: se fusiona solo con eso, y los manuales quedan absorbidos.
    const base = fusiona(automaticas);
    return {
      ...base,
      fusionada: true,
      fuentes: [...new Set(grupo.map((s) => s.fuente))],
      ids: grupo.map((s) => s.id),
      manual: false,
    };
  }

  const conPulso = grupo.filter((s) => s.pulsos.length > 0);
  // El corazon lo aporta quien lo mide. Si hay varios, manda el wearable.
  const corazon =
    conPulso.find((s) => esWearable(s.fuente)) ??
    conPulso[0] ??
    grupo.find((s) => esWearable(s.fuente)) ??
    grupo[0];

  // ⚠️ La distancia se toma como MAXIMO, no de la fuente preferida. Visto real: tomarla de
  // Nike daba 2,09 km cuando eran 4,13, porque su registro era de un tramo.
  const metros = Math.max(...grupo.map((s) => s.metros ?? 0)) || null;

  const inicio = Math.min(...grupo.map((s) => s.inicio));
  const fin = Math.max(...grupo.map((s) => s.fin));
  // La duracion activa mayor, no la suma: sumar duplicaria el tiempo solapado.
  const segundos = Math.max(...grupo.map((s) => s.segundos));

  // El ritmo, de quien tenga GPS. Si su distancia no es la ganadora, su ritmo es de un tramo
  // parcial y se recalcula sobre el total en vez de arrastrar un dato inconsistente.
  const gps = grupo.find((s) => s.ritmo && !esWearable(s.fuente)) ?? grupo.find((s) => s.ritmo);
  const ritmo =
    gps && (gps.metros ?? 0) === metros
      ? (gps.ritmo ?? corazon.ritmo ?? null)
      : metros
        ? +(segundos / metros).toFixed(4)
        : null;

  return {
    ...corazon,
    tipo: tipoDelGrupo(grupo),
    inicio,
    fin,
    segundos,
    metros,
    ritmo,
    pasos: corazon.pasos ?? grupo.find((s) => s.pasos != null)?.pasos ?? null,
    kcal: corazon.kcal ?? grupo.find((s) => s.kcal != null)?.kcal ?? null,
    fuentes: [...new Set(grupo.map((s) => s.fuente))],
    fusionada: true,
    ids: grupo.map((s) => s.id),
    // Aqui el grupo es homogeneo: o todo automatico o todo a mano.
    manual: automaticas.length === 0,
  };
}

/** Deduplica una lista completa, de las mas recientes a las mas antiguas. */
export function deduplica(
  sesiones: readonly SesionCruda[],
  umbral = UMBRAL_SOLAPE,
): readonly SesionFusionada[] {
  return agrupa(sesiones, umbral)
    .map(fusiona)
    .sort((a, b) => b.inicio - a.inicio);
}
