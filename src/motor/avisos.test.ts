import { sesionesQueAvisan, VENTANA_AVISO_MS } from './avisos';

/**
 * Qué sesiones avisan a la liga (decisión del usuario, 17 sep): TODAS las sesiones recientes, no
 * solo la última si fue fuerte. El servidor deduplica por huella y acota a 10 por liga y día.
 */
const HORA = 60 * 60_000;
const ahora = Date.UTC(2026, 8, 17, 12, 0, 0);
const s = (id: string, finHaceMs: number, liga: 'global' | 'padel' | 'correr' | null = 'padel') => ({
  id,
  fin: ahora - finHaceMs,
  liga,
});

describe('sesiones que avisan a una liga', () => {
  test('avisa de cada sesión reciente, sea suave, normal o fuerte: aquí no se mira el tono', () => {
    const lista = [s('a', 2 * HORA), s('b', 5 * HORA), s('c', 20 * HORA)];
    expect(sesionesQueAvisan(lista, ahora, 'global').map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  test('las de más de 24 horas no avisan: son historia, no noticia, y evitan la ráfaga del primer alta', () => {
    const lista = [s('vieja', 25 * HORA), s('reciente', 23 * HORA), s('muyVieja', 7 * 24 * HORA)];
    expect(sesionesQueAvisan(lista, ahora, 'global').map((x) => x.id)).toEqual(['reciente']);
  });

  test('en una liga de deporte solo avisan las sesiones de ese deporte; en la general, todas', () => {
    const lista = [s('p', HORA, 'padel'), s('r', 2 * HORA, 'correr'), s('sinLiga', 3 * HORA, null)];
    expect(sesionesQueAvisan(lista, ahora, 'padel').map((x) => x.id)).toEqual(['p']);
    expect(sesionesQueAvisan(lista, ahora, 'correr').map((x) => x.id)).toEqual(['r']);
    expect(sesionesQueAvisan(lista, ahora, 'global').map((x) => x.id)).toEqual(['sinLiga', 'r', 'p']);
  });

  test('en orden cronológico, la más antigua primero, para que los avisos lleguen en el orden real', () => {
    const lista = [s('ultima', HORA), s('primera', 6 * HORA), s('media', 3 * HORA)];
    expect(sesionesQueAvisan(lista, ahora, 'global').map((x) => x.id)).toEqual(['primera', 'media', 'ultima']);
  });

  test('una sesión que aún no ha terminado (reloj adelantado) no avisa', () => {
    expect(sesionesQueAvisan([s('futura', -HORA)], ahora, 'global')).toEqual([]);
  });

  test('la ventana es de 24 horas', () => {
    expect(VENTANA_AVISO_MS).toBe(24 * HORA);
  });
});
