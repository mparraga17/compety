import { CLAVES, almacenEnMemoria } from './almacen';

/**
 * `zonaHoraria.ts` toca tres cosas nativas: expo-localization (ESM), el cliente de Supabase y
 * AsyncStorage. Se mockean las tres y se prueba la lógica: qué se declara, cuándo, y qué pasa
 * cuando falla. Mismo patrón que `feed.test.ts`.
 */

let zonaDelSistema: string | null = 'Europe/Madrid';
jest.mock('expo-localization', () => ({
  getCalendars: () => [{ timeZone: zonaDelSistema }],
}));

const rpc = jest.fn<Promise<{ error: unknown }>, [string, Record<string, unknown>]>();
jest.mock('./supabase', () => ({
  HAY_SERVIDOR: true,
  supabase: { rpc: (...args: [string, Record<string, unknown>]) => rpc(...args) },
}));

const almacen = almacenEnMemoria();
jest.mock('./almacenNativo', () => ({ almacenNativo: () => almacen }));

// Después de los mocks, para que el módulo los vea.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { declararZonaHoraria, olvidaZonaHorariaDeclarada, zonaHorariaDelDispositivo } = require('./zonaHoraria') as typeof import('./zonaHoraria');

beforeEach(async () => {
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
  zonaDelSistema = 'Europe/Madrid';
  await almacen.borrar(CLAVES.zonaHoraria);
});

describe('zonaHorariaDelDispositivo', () => {
  it('devuelve la zona IANA del sistema', () => {
    for (const z of ['Europe/Madrid', 'America/Mexico_City', 'America/Argentina/Buenos_Aires', 'Etc/GMT+1', 'UTC']) {
      zonaDelSistema = z;
      expect(zonaHorariaDelDispositivo()).toBe(z);
    }
  });

  it('descarta lo que no es una zona IANA: el servidor lo rechazaría, y "GMT+1" a pelo significa otra cosa en Postgres', () => {
    for (const z of ['GMT+1', 'Madrid', 'Europe/Madrid/Centro/Sol', 'x y']) {
      zonaDelSistema = z;
      expect(zonaHorariaDelDispositivo()).toBeNull();
    }
  });

  it('si el sistema no da zona (web), cae a la de Intl', () => {
    // La suite corre en Europe/Madrid (jest.zona-horaria.js): eso es lo que Intl devuelve aquí.
    zonaDelSistema = null;
    expect(zonaHorariaDelDispositivo()).toBe('Europe/Madrid');
    zonaDelSistema = '';
    expect(zonaHorariaDelDispositivo()).toBe('Europe/Madrid');
  });
});

describe('declararZonaHoraria', () => {
  it('la primera vez la manda al servidor y la recuerda', async () => {
    expect(await declararZonaHoraria()).toBe('Europe/Madrid');
    expect(rpc).toHaveBeenCalledWith('elegir_zona_horaria', { p_zona: 'Europe/Madrid' });
    expect(await almacen.leer(CLAVES.zonaHoraria)).toBe('Europe/Madrid');
  });

  it('si no cambió, no vuelve a escribir: una escritura por cambio, no por arranque', async () => {
    await declararZonaHoraria();
    await declararZonaHoraria();
    await declararZonaHoraria();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('al viajar, declara la nueva', async () => {
    await declararZonaHoraria();
    zonaDelSistema = 'America/Mexico_City';
    expect(await declararZonaHoraria()).toBe('America/Mexico_City');
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith('elegir_zona_horaria', { p_zona: 'America/Mexico_City' });
  });

  it('si el servidor falla, lanza y NO la recuerda: se reintenta en el siguiente arranque', async () => {
    rpc.mockResolvedValue({ error: { message: 'Network request failed' } });
    await expect(declararZonaHoraria()).rejects.toBeTruthy();
    expect(await almacen.leer(CLAVES.zonaHoraria)).toBeNull();
  });

  it('sin zona utilizable no declara nada', async () => {
    zonaDelSistema = 'GMT+1';
    expect(await declararZonaHoraria()).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('olvidarla obliga a la siguiente cuenta a declarar la suya', async () => {
    await declararZonaHoraria();
    await olvidaZonaHorariaDeclarada();
    await declararZonaHoraria();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
