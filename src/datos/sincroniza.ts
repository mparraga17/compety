import { almacenNativo } from './almacenNativo';
import {
  anotarAviso,
  aplicarMovimientos,
  cerrarPeriodos,
  misLigas,
  periodoDe,
  subirPuntuacion,
  tonoDe,
  type LigaRemota,
  type Movimiento,
} from './ligas';
import { HAY_SERVIDOR } from './supabase';
import { entrenosParaPublicar, publicarEntrenos } from './feed';
import {
  guardaMaximo,
  guardaResumen,
  leeDeportes,
  leeEsfuerzos,
  leeMaximo,
  leeResumenes,
} from './almacen';
import { deduplica, type SesionCruda } from '../motor/fusion';
import { sesionesQueAvisan } from '../motor/avisos';
import { zDe } from '../motor/base';
import { HORIZONTES, rankeaVentana } from '../motor/ranking';
import { procesa, type Resultado } from '../motor/sesiones';
import { inicioDeBase, inicioDeLectura, limiteAsentado } from '../motor/ventanas';
import { RESUMEN_VACIO, maximoDeReferencia, resumenDePulsos } from '../motor/zonas';
import { leerPulsosDeSesion, leerPulsosEntre, leerSesionesDesde } from '../salud/lectura';
import { esTipoDeporte, tipoDe } from '../motor/actividades';

/**
 * Sincronizacion. Es la unica pieza que habla con HealthKit y con el servidor a la vez, y por
 * eso concentra la regla mas importante del producto:
 *
 *   los datos de salud se leen aqui, se calculan aqui, y NO salen de aqui.
 *
 * Al servidor sube la puntuacion, el numero de sesiones y un tono cualitativo. Nada mas.
 */

/** Nombre de la fuente que escribio la sesion. */
function fuenteDe(sesion: unknown): string {
  const s = sesion as {
    sourceRevision?: { source?: { name?: string; bundleIdentifier?: string } };
    device?: { name?: string; manufacturer?: string };
  };
  const src = s.sourceRevision?.source;
  return src?.name ?? src?.bundleIdentifier ?? s.device?.name ?? s.device?.manufacturer ?? 'desconocida';
}

/**
 * ¿Lo tecleo la persona en la app Salud? HealthKit lo marca con `HKWasUserEntered` en los
 * metadatos (verificado en los tipos generados de la libreria: `KnownObjectMetadata`). Se
 * compara con `true` a proposito: HealthKit lo guarda como booleano, pero un valor raro o ausente
 * significa "grabado", que es el caso normal.
 */
function esManual(sesion: unknown): boolean {
  const s = sesion as { metadata?: { HKWasUserEntered?: unknown } };
  return s.metadata?.HKWasUserEntered === true;
}

/**
 * Lee HealthKit y devuelve las sesiones ya puntuadas.
 *
 * ⚠️ El maximo de referencia se cachea, porque recalcularlo exige releer 90 dias de pulsos. Si
 * el guardado venia provisional se reintenta, para que en cuanto la persona apriete una vez las
 * intensidades dejen de estar aplanadas.
 */
/** Cuantas lecturas de HealthKit van a la vez. Es I/O local: 4 recorta la espera sin saturar. */
const LECTURAS_A_LA_VEZ = 4;

async function enLotes<T, R>(
  elementos: readonly T[],
  tamano: number,
  fn: (x: T) => Promise<R>,
): Promise<R[]> {
  const resultados: R[] = [];
  for (let i = 0; i < elementos.length; i += tamano) {
    resultados.push(...(await Promise.all(elementos.slice(i, i + tamano).map(fn))));
  }
  return resultados;
}

export async function calcula(ahora: Date = new Date()): Promise<Resultado> {
  const almacen = almacenNativo();

  let maximo = await leeMaximo(almacen);
  if (maximo === null) {
    const historico = await leerPulsosEntre(new Date(inicioDeBase(ahora)), ahora);
    const calculado = maximoDeReferencia(historico.map((p) => p.quantity));
    await guardaMaximo(almacen, calculado);
    maximo = { ...calculado, calculado: Date.now() };
  }

  const sesiones = await leerSesionesDesde(inicioDeLectura(ahora));
  const idDe = (s: (typeof sesiones)[number]) =>
    s.uuid ?? `${s.startDate.getTime()}|${String(s.workoutActivityType)}`;
  const asentadaAntesDe = limiteAsentado(ahora);

  // Pulsos de cada sesion. Se leen por rango de horas, porque el vinculo con el entreno solo
  // existe si la app que escribio los pulsos lo hizo, y el puente de Fitbit no lo hace.
  //
  // ⭐ Y se leen UNA vez: las sesiones asentadas ya tienen su resumen guardado y no vuelven a
  // HealthKit. En la primera lectura de un año entero se leen todas (una vez); despues, solo las
  // de los ultimos dias. Sin esto, cada sincronizacion serian cientos de consultas.
  const guardados = await leeResumenes(almacen, sesiones.map(idDe));

  const crudas: SesionCruda[] = await enLotes(sesiones, LECTURAS_A_LA_VEZ, async (s) => {
    const id = idDe(s);
    // ⛔ Tecleado a mano en Salud (`HKWasUserEntered`): no tiene pulso propio, asi que no se le
    // cruzan los pulsos de ese rango (los midio otra cosa) y se ahorran las consultas. Puntua
    // por estimacion o esfuerzo declarado, con su descuento. Regla de producto, 15 sep.
    const manual = esManual(s);
    const asentada = s.endDate.getTime() < asentadaAntesDe;

    let resumen = manual ? RESUMEN_VACIO : guardados[id];
    if (resumen === undefined) {
      const pulsos = await leerPulsosDeSesion(s);
      resumen = resumenDePulsos(
        pulsos.map((p) => ({ valor: p.quantity, inicio: p.startDate, fin: p.endDate })),
      );
      // Solo se guarda lo asentado: una sesion de ayer puede recibir pulsos hoy.
      if (asentada) await guardaResumen(almacen, id, resumen).catch(() => undefined);
    }

    return {
      id,
      tipo: tipoDe(s.workoutActivityType),
      fuente: fuenteDe(s),
      inicio: s.startDate.getTime(),
      fin: s.endDate.getTime(),
      segundos: (s.endDate.getTime() - s.startDate.getTime()) / 1000,
      // Las muestras crudas no viajan: el resumen ya lleva todo lo que el motor necesita.
      pulsos: [],
      resumen,
      manual,
    };
  });

  // Deduplicar es requisito del dia uno: Nike, Strava, Peloton y la pulsera escriben a la vez.
  const fusionadas = deduplica(crudas);

  // El esfuerzo declarado y el deporte corregido los genera la app y no existen en HealthKit.
  const [esfuerzos, deportes] = await Promise.all([
    leeEsfuerzos(almacen, fusionadas.map((s) => s.id)),
    leeDeportes(almacen, fusionadas.map((s) => s.id)),
  ]);

  return procesa(
    fusionadas.map((s) => {
      // ⭐ La correccion de deporte va ANTES de puntuar: asi el peso MET, el descuento sin
      // pulso y la liga salen del deporte real, no del "otro" que escribio Fitbit. Un valor
      // desconocido en el almacen se ignora, no se rompe nada.
      const corregido = deportes[s.id];
      return {
        ...s,
        tipo: esTipoDeporte(corregido) ? corregido : s.tipo,
        rpe: esfuerzos[s.id] ?? null,
      };
    }),
    maximo.valor,
    // La base personal es movil, de 90 dias, la lea quien la lea: los puntos de la pantalla y
    // los que suben son los mismos. Las ventanas y su porque, en `motor/ventanas.ts`.
    { baseDesde: inicioDeBase(ahora) },
  );
}

export type Sincronizacion = {
  ligas: readonly LigaRemota[];
  subidas: number;
  avisos: number;
  /** Tus ascensos y descensos de la jornada que se acaba de cerrar, si los hay. */
  movimientos: readonly Movimiento[];
  /** true si no hay servidor configurado. La app sigue siendo util en solitario. */
  soloLocal: boolean;
};

/**
 * Calcula y sube.
 *
 * Idempotente de punta a punta: la puntuacion se sobreescribe por clave primaria y el aviso
 * lleva una huella unica. El segundo plano puede despertar la app varias veces con los mismos
 * datos y no se duplica nada.
 */
export async function sincroniza(): Promise<Sincronizacion> {
  // El año entero (ver `inicioDeLectura`): es lo que hace anual a la clasificacion anual.
  const resultado = await calcula();

  if (!HAY_SERVIDOR) {
    return { ligas: [], subidas: 0, avisos: 0, movimientos: [], soloLocal: true };
  }

  // Primero se cierran los periodos pasados, antes de escribir nada. Asi una semana terminada
  // queda congelada con la puntuacion que tuvo, y no se reescribe con la base personal de hoy.
  await cerrarPeriodos().catch(() => 0);

  // ⭐ Y la jornada de las ligas de zona: quien sube y quien baja. Va ANTES de leer las ligas,
  // porque un ascenso te cambia de division y hay que puntuar ya en la nueva. Idempotente por
  // el candado del servidor, y si falla no bloquea la sincronizacion: la jornada la cerrara
  // el siguiente miembro que abra la app.
  const movimientos = await aplicarMovimientos().catch(() => [] as readonly Movimiento[]);

  const ligas = await misLigas();
  let subidas = 0;
  let avisos = 0;

  // ⭐ El feed de amigos: cada entreno, con su tipo, sus puntos y su tono, para que tu gente
  // pueda aplaudirlo. Idempotente por huella (repetir no duplica; corregir el deporte actualiza).
  // Si falla no frena las puntuaciones: el feed es social, la liga es el producto.
  await publicarEntrenos(entrenosParaPublicar(resultado)).catch(() => 0);

  for (const liga of ligas) {
    // La liga general acepta todo; las de deporte filtran por su lista de tipos.
    const filtro = liga.deporte ?? 'global';

    for (const horizonte of HORIZONTES) {
      const r = rankeaVentana(resultado.sesiones, horizonte, {
        liga: filtro as 'global',
      });
      if (r.validas === 0) continue;

      // El tono compara la media de tus mejores con TU propia base, nunca en absoluto.
      const tono = tonoDe(zDe(r.media, { ...resultado.base, media: 50, sigma: 15 }));

      await subirPuntuacion({
        liga: liga.id,
        horizonte: horizonte.id,
        puntos: r.total,
        sesiones: r.validas,
        tono,
      });
      subidas += 1;
    }

    // ⭐ Avisos: TODA sesion terminada en las ultimas 24 horas (decision del usuario, 17 sep).
    // Antes solo la ultima de la semana y solo si era fuerte: en diez dias de beta, 25 sesiones
    // de un amigo y un solo aviso. El porque de la ventana y del orden esta en `motor/avisos`.
    // El tono ya no decide si se avisa; viaja en el aviso para que el texto lo cuente.
    for (const s of sesionesQueAvisan(resultado.sesiones, Date.now(), filtro)) {
      const tono = tonoDe(zDe(s.carga, resultado.base));
      // La huella incluye la sesion, asi que repetir la sincronizacion no reavisa. El servidor
      // la cualifica ademas con el autor (migracion 12) y acota a 10 por liga y dia.
      //
      // ⚠️ El aviso es un EFECTO SECUNDARIO de la puntuacion, no la puntuacion. Si el servidor lo
      // rechaza (cupo de avisos, clase no admitida) o falla la red justo aqui, la sincronizacion
      // de las demas ligas tiene que seguir: sin este catch, un aviso caido cortaba el bucle y
      // dejaba ligas sin puntuar. Lo que se traga es el aviso, y solo el aviso.
      const anotado = await anotarAviso({
        liga: liga.id,
        clase: 'sesion',
        puntos: s.puntos,
        tono,
        huella: `${liga.id}|${s.id}`,
      })
        .then(() => true)
        .catch(() => false);
      if (anotado) avisos += 1;
    }
  }

  return { ligas, subidas, avisos, movimientos, soloLocal: false };
}

/** Periodo actual, para que la interfaz pida la clasificacion correcta. */
export const periodoActual = periodoDe;
