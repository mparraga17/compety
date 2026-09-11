import { destinoDe } from './destino';

describe('destino de un aviso al tocarlo', () => {
  test('los avisos de liga llevan a esa liga', () => {
    expect(destinoDe({ clase: 'sesion', liga: 'L1' })).toEqual({ tipo: 'liga', liga: 'L1' });
    expect(destinoDe({ clase: 'liderato', liga: 'L1' })).toEqual({ tipo: 'liga', liga: 'L1' });
    // Sin liga no hay a dónde ir: mejor quedarse que abrir algo equivocado.
    expect(destinoDe({ clase: 'sesion' })).toBeNull();
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
