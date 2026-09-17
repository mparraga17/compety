import { sesionesQueAvisan, VENTANA_AVISO_MS } from './avisos';

/**
 * Qué sesiones avisan a tus amigos (decisión del usuario, 17 sep): TODAS las recientes, no solo la
 * última si fue fuerte, y sin mirar la liga ni el deporte: el reparto entre amigos lo hace el
 * servidor. Aquí solo se decide cuáles son "recientes" y en qué orden.
 */
const HORA = 60 * 60_000;
const ahora = Date.UTC(2026, 8, 17, 12, 0, 0);
const s = (id: string, finHaceMs: number) => ({ id, fin: ahora - finHaceMs });

describe('sesiones que avisan a los amigos', () => {
  test('avisa de cada sesión reciente, sea suave, normal o fuerte: aquí no se mira el tono', () => {
    const lista = [s('a', 2 * HORA), s('b', 5 * HORA), s('c', 20 * HORA)];
    expect(sesionesQueAvisan(lista, ahora).map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  test('las de más de 24 horas no avisan: son historia, no noticia, y evitan la ráfaga del primer alta', () => {
    const lista = [s('vieja', 25 * HORA), s('reciente', 23 * HORA), s('muyVieja', 7 * 24 * HORA)];
    expect(sesionesQueAvisan(lista, ahora).map((x) => x.id)).toEqual(['reciente']);
  });

  test('en orden cronológico, la más antigua primero, para que los avisos lleguen en el orden real', () => {
    const lista = [s('ultima', HORA), s('primera', 6 * HORA), s('media', 3 * HORA)];
    expect(sesionesQueAvisan(lista, ahora).map((x) => x.id)).toEqual(['primera', 'media', 'ultima']);
  });

  test('una sesión que aún no ha terminado (reloj adelantado) no avisa', () => {
    expect(sesionesQueAvisan([s('futura', -HORA)], ahora)).toEqual([]);
  });

  test('sin sesiones, sin avisos', () => {
    expect(sesionesQueAvisan([], ahora)).toEqual([]);
  });

  test('la ventana es de 24 horas', () => {
    expect(VENTANA_AVISO_MS).toBe(24 * HORA);
  });
});
