/**
 * Divisiones de las ligas de zona: quién sube y quién baja.
 *
 * ⭐ El patrón es el de Duolingo, que está medido (blog.duolingo.com/duolingo-leagues-
 * leaderboards): cohortes pequeñas para que todos vean una posición alcanzable delante,
 * reasignación semanal para que nadie quede atrapado abajo, y ventana de 7 días para que
 * una mala semana no te hunda el mes. PRODUCTO.md lo tenía como el hueco más grande.
 *
 * ⚠️ `cuantosMueven` es la RÉPLICA EXACTA de `cuantos_mueven` en
 * `supabase/migracion-06-zonas.sql`. El servidor decide los movimientos; esta copia solo
 * pinta las zonas de ascenso y descenso en la tabla. Si cambia una, cambia la otra.
 */

/** Miembros a partir de los cuales una división está llena y se abre otra debajo. */
export const COHORTE_MAXIMA = 30;

/**
 * Cuántos suben y cuántos bajan en una división de n miembros.
 *
 *   n < 4     → 0   mover a alguien en una liga de 2 o 3 es ruido, no competición
 *   n 4-7     → 1
 *   n 8-11    → 2
 *   n >= 12   → 3   tope: más conservador que el tercio de Duolingo, porque las
 *                   divisiones de barrio serán pequeñas
 */
export function cuantosMueven(n: number): number {
  if (n < 4) return 0;
  return Math.min(3, Math.floor(n / 4));
}

/** Lo que la tabla marca en cada puesto de una liga de zona. */
export type FranjaDivision = 'sube' | 'queda' | 'baja';

/**
 * Franja de un puesto (base 1) en una división.
 *
 * ⚠️ Hace falta saber si hay división arriba y abajo: en la División 1 nadie sube, y en la
 * más baja nadie baja. Es la misma condición del SQL.
 */
export function franjaDe(
  puesto: number,
  n: number,
  { primera, ultima }: { primera: boolean; ultima: boolean },
): FranjaDivision {
  const mueven = cuantosMueven(n);
  if (!primera && puesto <= mueven) return 'sube';
  if (!ultima && puesto > n - mueven) return 'baja';
  return 'queda';
}
