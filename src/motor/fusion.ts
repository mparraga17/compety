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
};

export type SesionFusionada = SesionCruda & {
  fuentes: readonly string[];
  fusionada: boolean;
  /** Ids originales que se unieron. Sirve para no notificar dos veces lo mismo. */
  ids: readonly string[];
};

/** Solape minimo respecto a la sesion mas corta para considerarlas la misma. */
export const UMBRAL_SOLAPE = 0.5;

/**
 * Agrupa sesiones que son la misma cosa vista por fuentes distintas.
 *
 * Dos registros van juntos si comparten tipo y se solapan por encima del umbral respecto al
 * mas corto. Los grupos son transitivos, con union-find, y eso es lo que cubre el caso N:1:
 * si Nike partio una carrera en dos y la pulsera la vio entera, comparar por pares dejaria
 * uno de los trozos suelto.
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
      if (orden[i].tipo !== orden[j].tipo) continue;

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

/** Une un grupo en una sesion: cada campo lo aporta quien lo mide mejor. */
export function fusiona(grupo: readonly SesionCruda[]): SesionFusionada {
  if (grupo.length === 1) {
    return { ...grupo[0], fuentes: [grupo[0].fuente], fusionada: false, ids: [grupo[0].id] };
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
