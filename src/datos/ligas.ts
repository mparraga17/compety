import { HAY_SERVIDOR, supabase, usuarioActual } from './supabase';
import type { IdHorizonte } from '../motor/ranking';

/**
 * Ligas contra el servidor.
 *
 * ⚠️ Recordatorio de lo que viaja: puntos, numero de sesiones y un tono cualitativo. Nada mas.
 * Ni pulsos, ni zonas, ni minutos de esfuerzo. Si alguien anade un campo de salud aqui, esta
 * rompiendo la arquitectura y la guia 5.1.3 de Apple a la vez.
 */

export type LigaRemota = {
  id: string;
  nombre: string;
  /** id de liga del motor, o null en la general. */
  deporte: string | null;
  codigo: string;
  miembros: number;
  /** Solo en ligas públicas de zona (ciudad o distrito). Las privadas van con null. */
  zona: ZonaDeLiga | null;
};

/** Datos de zona de una liga pública. `division` 1 es la de arriba. */
export type ZonaDeLiga = {
  ciudad: string;
  distrito: string | null;
  division: number;
  /** Cuántas divisiones tiene la zona, para saber si hay descenso posible. */
  divisiones: number;
};

/** Un ascenso o descenso propio de la última jornada cerrada. */
export type Movimiento = {
  ciudad: string;
  distrito: string | null;
  /** Lunes de la semana que se cerró. */
  semana: string;
  de: number;
  a: number;
};

export type Puesto = {
  usuario: string;
  nombre: string;
  puntos: number;
  sesiones: number;
  tono: Tono | null;
};

/** Comparado con la base PROPIA de esa persona, nunca en absoluto. */
export type Tono = 'suave' | 'normal' | 'fuerte';

/** Etiqueta cualitativa a partir del z respecto a la propia media. */
export function tonoDe(z: number): Tono {
  if (z >= 1) return 'fuerte';
  if (z <= -1) return 'suave';
  return 'normal';
}

/** Dia de cierre del periodo, en hora local. */
export function periodoDe(fecha: Date = new Date()): string {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

function sinServidor(): never {
  throw new Error('sin-servidor');
}

export async function misLigas(): Promise<readonly LigaRemota[]> {
  if (!HAY_SERVIDOR) return [];

  // Orden fijo por antigüedad: sin `order` Postgres devuelve las filas en el orden que le
  // convenga, y la primera de la lista es la que se enseña por defecto.
  const { data, error } = await supabase
    .from('ligas')
    .select('id, nombre, deporte, codigo, division, miembros(count), zonas(ciudad, distrito, divisiones)')
    .order('creado', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((l) => {
    // El join de zonas llega como objeto o como array según la versión de PostgREST.
    const cruda = l.zonas as
      | { ciudad: string; distrito: string | null; divisiones: number }
      | { ciudad: string; distrito: string | null; divisiones: number }[]
      | null;
    const z = Array.isArray(cruda) ? (cruda[0] ?? null) : cruda;

    return {
      id: l.id as string,
      nombre: l.nombre as string,
      deporte: (l.deporte as string | null) ?? null,
      codigo: l.codigo as string,
      miembros: (l.miembros as { count: number }[] | null)?.[0]?.count ?? 1,
      zona:
        z === null || l.division === null
          ? null
          : {
              ciudad: z.ciudad,
              distrito: z.distrito,
              division: l.division as number,
              divisiones: z.divisiones,
            },
    };
  });
}

/**
 * Entrar en las ligas públicas de tu zona: la de la ciudad y, si lo das, la del distrito.
 *
 * ⭐ La zona la CONFIRMA la persona. El GPS existe solo como atajo que rellena los campos
 * (decisión del usuario, 8 sep): la coordenada se convierte en nombres en el teléfono y se
 * tira, aquí llegan solo los nombres. `docs/privacy-es.html` sección 6 documenta el detalle.
 *
 * El servidor te coloca en la división que toca: se entra por la más baja, y al llenarse la
 * cohorte de 30 se estrena una nueva por debajo. Cambiar de zona te saca de la anterior.
 */
export async function unirseAZona(ciudad: string, distrito: string | null): Promise<void> {
  if (!HAY_SERVIDOR) sinServidor();

  const { error } = await supabase.rpc('unirse_a_zona', {
    p_ciudad: ciudad.trim(),
    p_distrito: distrito === null || distrito.trim() === '' ? null : distrito.trim(),
  });
  if (error) throw error;
}

/**
 * Distritos con liga viva en una ciudad, leídos de `zonas` (visible con sesión, a propósito:
 * solo contiene nombres de lugar). Alimenta el desplegable junto al catálogo curado: una
 * liga con gente dentro vale más que un nombre oficial vacío.
 *
 * `ilike` cubre mayúsculas pero no acentos; el cruce fino por clave normalizada lo hace
 * `fusionaDistritos` en el teléfono.
 */
export async function distritosVivos(ciudad: string): Promise<readonly string[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase
    .from('zonas')
    .select('distrito')
    .ilike('ciudad', ciudad.trim())
    .not('distrito', 'is', null);
  if (error) throw error;

  return (data ?? []).map((z) => z.distrito as string);
}

/**
 * Ciudades con liga viva, para el buscador de ciudad. Misma fuente y mismo criterio que
 * `distritosVivos`: la tabla `zonas` solo contiene nombres de lugar y es legible con
 * sesión a propósito. El duplicado exacto se quita aquí; el fino (acentos, mayúsculas) lo
 * absorbe `fusionaCiudades` por clave normalizada en el teléfono.
 */
export async function ciudadesVivas(): Promise<readonly string[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase.from('zonas').select('ciudad');
  if (error) throw error;

  return [...new Set((data ?? []).map((z) => z.ciudad as string))];
}

/** Salirse de las ligas de zona. Las privadas no se tocan. */
export async function salirDeZona(): Promise<void> {
  if (!HAY_SERVIDOR) return;
  const { error } = await supabase.rpc('salir_de_zona');
  if (error) throw error;
}

/**
 * Cierra la jornada semanal de tus zonas y devuelve TUS ascensos y descensos.
 *
 * Idempotente: la jornada lleva candado en el servidor (`cierres_zona`), así que da igual
 * cuántos miembros la disparen ni cuántas veces. Se llama al sincronizar, como
 * `cerrarPeriodos`.
 */
export async function aplicarMovimientos(hoy = periodoDe()): Promise<readonly Movimiento[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase.rpc('aplicar_movimientos', { p_hoy: hoy });
  if (error) throw error;

  return ((data ?? []) as {
    mov_ciudad: string;
    mov_distrito: string | null;
    mov_semana: string;
    mov_de: number;
    mov_a: number;
  }[]).map((m) => ({
    ciudad: m.mov_ciudad,
    distrito: m.mov_distrito,
    semana: m.mov_semana,
    de: m.mov_de,
    a: m.mov_a,
  }));
}

export async function crearLiga(
  nombre: string,
  deporte: string | null = null,
): Promise<{ id: string; codigo: string }> {
  if (!HAY_SERVIDOR) sinServidor();

  const { data, error } = await supabase
    .rpc('crear_liga', { p_nombre: nombre, p_deporte: deporte })
    .single();
  if (error) throw error;

  // ⚠️ El RPC devuelve `liga_id` y `liga_codigo`, no `id` y `codigo`. Se renombraron en la
  // migracion 03 porque los nombres cortos chocaban con las columnas de la tabla `ligas` dentro
  // de la funcion y Postgres daba 42702 «column reference is ambiguous» al crear una liga.
  const fila = data as { liga_id: string; liga_codigo: string };
  return { id: fila.liga_id, codigo: fila.liga_codigo };
}

/** Entrar con el codigo de seis caracteres que te pasan. */
export async function entrarEnLiga(codigo: string): Promise<string> {
  if (!HAY_SERVIDOR) sinServidor();

  const { data, error } = await supabase.rpc('entrar_en_liga', {
    p_codigo: codigo.trim().toUpperCase(),
  });
  if (error) throw error;
  return data as string;
}

export async function clasificacion(
  liga: string,
  horizonte: IdHorizonte,
  periodo = periodoDe(),
): Promise<readonly Puesto[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase.rpc('clasificacion', {
    p_liga: liga,
    p_horizonte: horizonte,
    p_periodo: periodo,
  });
  if (error) throw error;
  return (data ?? []) as Puesto[];
}

/**
 * Sube tu puntuacion de una liga y una ventana.
 *
 * Idempotente por la clave primaria (liga, usuario, horizonte, periodo), asi que el segundo
 * plano puede llamarlo varias veces con los mismos datos sin duplicar nada.
 */
export async function subirPuntuacion(entrada: {
  liga: string;
  horizonte: IdHorizonte;
  puntos: number;
  sesiones: number;
  tono: Tono;
  periodo?: string;
}): Promise<void> {
  if (!HAY_SERVIDOR) return;

  // Sin sesion LANZA, no vuelve en silencio: una puntuacion que no se puede subir tiene que
  // fallar donde se ve, no contarse como subida.
  const usuario = await usuarioActual();

  const { error } = await supabase.from('puntuaciones').upsert(
    {
      liga: entrada.liga,
      usuario,
      horizonte: entrada.horizonte,
      periodo: entrada.periodo ?? periodoDe(),
      puntos: entrada.puntos,
      sesiones: entrada.sesiones,
      tono: entrada.tono,
      actualizado: new Date().toISOString(),
    },
    { onConflict: 'liga,usuario,horizonte,periodo' },
  );
  // Una semana ya cerrada no se reescribe, y eso no es un fallo: es la garantia de que quien
  // gano el lunes sigue habiendo ganado el jueves. El disparador del servidor lo rechaza.
  if (error !== null && !/ya esta cerrada/.test(error.message)) throw error;
}

/**
 * Cierra los periodos que ya pasaron.
 *
 * ⭐ Congelar al cerrar es una decision con motivo. La base personal se recalcula al llegar datos
 * nuevos, asi que sin esto una semana terminada podria cambiar de puntuacion y quien gano podria
 * dejar de haber ganado. La teoria de la autodeterminacion dice que perder la competencia
 * percibida predice abandono, y quitarle a alguien una victoria ya conseguida es la forma mas
 * directa de hacerlo.
 *
 * El cierre va por hora LOCAL de cada persona, que es la que esa persona vivio.
 */
export async function cerrarPeriodos(hoy = periodoDe()): Promise<number> {
  if (!HAY_SERVIDOR) return 0;
  const { data, error } = await supabase.rpc('cerrar_periodos', { p_hoy: hoy });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/**
 * Anota un aviso para que el servidor lo envie.
 *
 * ⛔ Solo se pasa puntuacion y tono. La restriccion de Apple es literal: no se puede revelar
 * informacion obtenida de HealthKit a un tercero sin permiso expreso. El tono sale de comparar
 * con la base propia de quien entrena, asi que no expone ningun valor de salud.
 *
 * La huella evita avisar dos veces de la misma sesion si el segundo plano se repite.
 *
 * ⭐ Desde la migracion 14 (17 sep) el aviso de sesion NO es de liga: va a los amigos del autor, y
 * `liga` se manda null. El parametro sigue en la firma por el cliente viejo, que manda una liga y
 * una huella `liga|sesion`; el servidor la ignora y normaliza la huella a la sesion.
 */
export async function anotarAviso(entrada: {
  liga: string | null;
  clase: 'sesion';
  puntos: number;
  tono: Tono;
  huella: string;
}): Promise<void> {
  if (!HAY_SERVIDOR) return;

  const { error } = await supabase.rpc('anotar_aviso', {
    p_liga: entrada.liga,
    p_clase: entrada.clase,
    p_puntos: entrada.puntos,
    p_tono: entrada.tono,
    p_huella: entrada.huella,
  });
  if (error) throw error;
}

/** Un puesto de un periodo ya cerrado. `puesto` 1 es el ganador del tramo. */
export type PuestoCerrado = {
  /** Primer día del tramo: lunes, día 1 del mes o 1 de enero. */
  inicio: string;
  usuario: string;
  nombre: string;
  puntos: number;
  sesiones: number;
  puesto: number;
};

/** Horizontes que tienen cierre. Los móviles (d7, d30) no cierran: son ventanas de consulta. */
export type IdCierre = 'wtd' | 'mtd' | 'ytd';

/**
 * ⭐ Resultados FINALES de los periodos ya terminados: las jornadas de la liga.
 *
 * Existe porque la competición no terminaba nunca. La ventana por defecto es móvil y no se
 * cierra jamás, y aunque el servidor congelaba filas, ningún sitio mostraba un RESULTADO. Una
 * liga sin jornadas es una clasificación que fluctúa para siempre: nadie gana y nadie vuelve
 * el lunes a ver quién ganó. El ciclo semana→resultado→semana es lo que hace liga a una liga,
 * y es el mecanismo del modelo Duolingo que cita el análisis de producto.
 *
 * Semana, mes y año (decisión del usuario, 7 sep): la semana da el ritmo, el mes la
 * tendencia y el año la historia.
 */
export async function palmares(
  liga: string,
  horizonte: IdCierre,
): Promise<readonly PuestoCerrado[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase.rpc('palmares', {
    p_liga: liga,
    p_horizonte: horizonte,
    p_hoy: periodoDe(),
  });
  if (error) throw error;
  return (data ?? []) as PuestoCerrado[];
}

/**
 * Ranking anual de semanas ganadas: la clasificación de la temporada.
 *
 * Es la pieza del cierre de año que pidió el usuario, y mide lo correcto: la historia del
 * año no es quién sumó más puntos en diciembre, es quién ganó más jornadas.
 */
export async function semanasGanadas(
  liga: string,
  anio: number = new Date().getFullYear(),
): Promise<readonly { usuario: string; nombre: string; ganadas: number }[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase.rpc('semanas_ganadas', {
    p_liga: liga,
    p_anio: anio,
    p_hoy: periodoDe(),
  });
  if (error) throw error;
  return (data ?? []) as { usuario: string; nombre: string; ganadas: number }[];
}

/** Apagar o encender los avisos de una liga concreta. Requisito de autonomia. */
export async function cambiarAvisos(liga: string, avisos: boolean): Promise<void> {
  if (!HAY_SERVIDOR) return;

  const usuario = await usuarioActual();

  const { error } = await supabase
    .from('miembros')
    .update({ avisos })
    .eq('liga', liga)
    .eq('usuario', usuario);
  if (error) throw error;
}

// El borrado de cuenta vive en `cuenta.ts` y pasa por la Edge Function `borrar-cuenta`, que revoca el
// Sign in with Apple antes de llamar a `borrar_mi_cuenta()`. Llamar al RPC directamente desde la app
// (lo que había aquí hasta el 16 sep) borraba sin revocar: no debe volver a existir ese atajo.
