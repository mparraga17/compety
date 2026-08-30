import { almacenNativo } from './almacenNativo';
import {
  anotarAviso,
  cerrarPeriodos,
  misLigas,
  periodoDe,
  subirPuntuacion,
  tonoDe,
  type LigaRemota,
} from './ligas';
import { HAY_SERVIDOR } from './supabase';
import { leeEsfuerzos, leeMaximo, guardaMaximo } from './almacen';
import { deduplica, type SesionCruda } from '../motor/fusion';
import { zDe } from '../motor/base';
import { HORIZONTES, rankeaVentana, enVentana } from '../motor/ranking';
import { procesa, type Resultado } from '../motor/sesiones';
import { maximoDeReferencia } from '../motor/zonas';
import { leerPulsosDeSesion, leerPulsosEntre, leerSesiones } from '../salud/lectura';
import { tipoDe } from '../motor/actividades';

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
 * Lee HealthKit y devuelve las sesiones ya puntuadas.
 *
 * ⚠️ El maximo de referencia se cachea, porque recalcularlo exige releer 90 dias de pulsos. Si
 * el guardado venia provisional se reintenta, para que en cuanto la persona apriete una vez las
 * intensidades dejen de estar aplanadas.
 */
export async function calcula(dias = 30): Promise<Resultado> {
  const almacen = almacenNativo();

  let maximo = await leeMaximo(almacen);
  if (maximo === null) {
    const hace90 = new Date();
    hace90.setDate(hace90.getDate() - 90);
    const historico = await leerPulsosEntre(hace90, new Date());
    const calculado = maximoDeReferencia(historico.map((p) => p.quantity));
    await guardaMaximo(almacen, calculado);
    maximo = { ...calculado, calculado: Date.now() };
  }

  const sesiones = await leerSesiones(dias);

  // Pulsos de cada sesion. Se lee por rango de horas, porque el vinculo con el entreno solo
  // existe si la app que escribio los pulsos lo hizo, y el puente de Fitbit no lo hace.
  const crudas: SesionCruda[] = [];
  for (const s of sesiones) {
    const pulsos = await leerPulsosDeSesion(s);
    crudas.push({
      id: s.uuid ?? `${s.startDate.getTime()}|${String(s.workoutActivityType)}`,
      tipo: tipoDe(s.workoutActivityType),
      fuente: fuenteDe(s),
      inicio: s.startDate.getTime(),
      fin: s.endDate.getTime(),
      segundos: (s.endDate.getTime() - s.startDate.getTime()) / 1000,
      pulsos: pulsos.map((p) => ({ valor: p.quantity, inicio: p.startDate, fin: p.endDate })),
    });
  }

  // Deduplicar es requisito del dia uno: Nike, Strava, Peloton y la pulsera escriben a la vez.
  const fusionadas = deduplica(crudas);

  // El esfuerzo declarado lo genera la app y no existe en HealthKit.
  const esfuerzos = await leeEsfuerzos(almacen, fusionadas.map((s) => s.id));

  return procesa(
    fusionadas.map((s) => ({ ...s, rpe: esfuerzos[s.id] ?? null })),
    maximo.valor,
  );
}

export type Sincronizacion = {
  ligas: readonly LigaRemota[];
  subidas: number;
  avisos: number;
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
  const resultado = await calcula(30);

  if (!HAY_SERVIDOR) {
    return { ligas: [], subidas: 0, avisos: 0, soloLocal: true };
  }

  // Primero se cierran los periodos pasados, antes de escribir nada. Asi una semana terminada
  // queda congelada con la puntuacion que tuvo, y no se reescribe con la base personal de hoy.
  await cerrarPeriodos().catch(() => 0);

  const ligas = await misLigas();
  let subidas = 0;
  let avisos = 0;

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

    // ⭐ Avisos: solo la ventana de 7 dias y solo si la ULTIMA sesion fue fuerte para ti.
    // No se avisa de cada paseo. La teoria de la autodeterminacion dice que el ruido genera
    // motivacion controlada, que predice abandono.
    const semana = HORIZONTES.find((h) => h.id === 'd7')!;
    const dentro = resultado.sesiones.filter((s) =>
      enVentana([s], semana).length > 0 && (filtro === 'global' || s.liga === filtro),
    );
    const ultima = [...dentro].sort((a, b) => b.inicio - a.inicio)[0];

    if (ultima !== undefined) {
      const z = zDe(ultima.carga, resultado.base);
      const tono = tonoDe(z);
      if (tono === 'fuerte') {
        // La huella incluye la sesion, asi que repetir la sincronizacion no reavisa.
        await anotarAviso({
          liga: liga.id,
          clase: 'sesion',
          puntos: ultima.puntos,
          tono,
          huella: `${liga.id}|${ultima.id}`,
        });
        avisos += 1;
      }
    }
  }

  return { ligas, subidas, avisos, soloLocal: false };
}

/** Periodo actual, para que la interfaz pida la clasificacion correcta. */
export const periodoActual = periodoDe;
