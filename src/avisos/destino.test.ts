import { destinoDe } from './destino';

describe('destino de un aviso al tocarlo', () => {
  test('los avisos de liga llevan a esa liga', () => {
    // Un aviso de sesión ANTIGUO (anterior a la migración 14) traía liga: sigue llevando a ella.
    expect(destinoDe({ clase: 'sesion', liga: 'L1' })).toEqual({ tipo: 'liga', liga: 'L1' });
    expect(destinoDe({ clase: 'liderato', liga: 'L1' })).toEqual({ tipo: 'liga', liga: 'L1' });
    // El liderato sin liga no tiene a dónde ir: mejor quedarse que abrir algo equivocado.
    expect(destinoDe({ clase: 'liderato' })).toBeNull();
  });

  test('la sesión de un amigo lleva al feed, a su entreno si viene resuelto', () => {
    expect(destinoDe({ clase: 'sesion', entreno: 'E1' })).toEqual({ tipo: 'feed', entreno: 'E1' });
    expect(destinoDe({ clase: 'sesion' })).toEqual({ tipo: 'feed', entreno: null });
  });

  test('pedir y aceptar amistad llevan a la bandeja de amigos', () => {
    expect(destinoDe({ clase: 'amistad' })).toEqual({ tipo: 'amigos' });
    expect(destinoDe({ clase: 'amistad_aceptada' })).toEqual({ tipo: 'amigos' });
  });

  test('reacciones y comentarios llevan al feed, con el entreno si viene', () => {
    expect(destinoDe({ clase: 'reaccion', entreno: 'E1' })).toEqual({ tipo: 'feed', entreno: 'E1' });
    expect(destinoDe({ clase: 'comentario' })).toEqual({ tipo: 'feed', entreno: null });
  });

  test('datos rotos o desconocidos no llevan a ningún sitio', () => {
    expect(destinoDe(null)).toBeNull();
    expect(destinoDe('sesion')).toBeNull();
    expect(destinoDe({ clase: 'otra' })).toBeNull();
    expect(destinoDe({})).toBeNull();
  });
});
