import {
  CLAVES,
  actualizaCuenta,
  almacenEnMemoria,
  guardaCuenta,
  leeCuenta,
  olvidaCuenta,
} from './almacen';

/**
 * Lo que protegen estos tests: que la copia local de la cuenta no devuelva NUNCA una identidad
 * que no toca. Es lo que permite arrancar sin red sin riesgo de enseñarle a alguien la cuenta
 * de otra persona que usó el mismo teléfono.
 */
describe('copia local de la cuenta', () => {
  const manuel = { id: 'u-1', correo: 'm@x.es', nombre: 'Manuel', usuario: 'manu' };

  test('lo que se guarda se lee igual', async () => {
    const almacen = almacenEnMemoria();
    await guardaCuenta(almacen, manuel);
    expect(await leeCuenta(almacen)).toEqual(manuel);
    expect(await leeCuenta(almacen, 'u-1')).toEqual(manuel);
  });

  test('sin copia devuelve null, no una cuenta vacia', async () => {
    expect(await leeCuenta(almacenEnMemoria())).toBeNull();
  });

  test('la copia de OTRA persona no se devuelve aunque exista', async () => {
    const almacen = almacenEnMemoria();
    await guardaCuenta(almacen, manuel);
    expect(await leeCuenta(almacen, 'u-2')).toBeNull();
  });

  test('una copia corrupta o sin id se trata como ausente', async () => {
    expect(await leeCuenta(almacenEnMemoria({ [CLAVES.cuenta]: '{no es json' }))).toBeNull();
    expect(
      await leeCuenta(almacenEnMemoria({ [CLAVES.cuenta]: JSON.stringify({ nombre: 'X' }) })),
    ).toBeNull();
    // Campos con tipo raro se normalizan a null en vez de colarse en la interfaz.
    const rara = await leeCuenta(
      almacenEnMemoria({ [CLAVES.cuenta]: JSON.stringify({ id: 'u-1', nombre: 7, usuario: null }) }),
    );
    expect(rara).toEqual({ id: 'u-1', correo: null, nombre: null, usuario: null });
  });

  test('actualizar cambia solo lo que se pide y conserva el resto', async () => {
    const almacen = almacenEnMemoria();
    await guardaCuenta(almacen, manuel);
    await actualizaCuenta(almacen, { usuario: 'manuel_p' });
    expect(await leeCuenta(almacen)).toEqual({ ...manuel, usuario: 'manuel_p' });
  });

  test('actualizar sin copia previa no inventa una cuenta sin id', async () => {
    const almacen = almacenEnMemoria();
    await actualizaCuenta(almacen, { nombre: 'Nadie' });
    expect(await leeCuenta(almacen)).toBeNull();
    expect(almacen.volcado()).toEqual({});
  });

  test('olvidar la deja como si nunca hubiera existido', async () => {
    const almacen = almacenEnMemoria();
    await guardaCuenta(almacen, manuel);
    await olvidaCuenta(almacen);
    expect(await leeCuenta(almacen)).toBeNull();
  });
});
