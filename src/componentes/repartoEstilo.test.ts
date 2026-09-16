import type { ViewStyle } from 'react-native';

import { repartirEstilo } from './repartoEstilo';

/**
 * El bug (16 sep): en Competi, el fondo gris del periodo no caía sobre "7 días". `Segmentado`
 * calculaba el fondo en quintos de la pista, pero cada pestaña medía lo que medía su texto, porque
 * `Pulsable` ponía el `flex: 1` en la vista de DENTRO y Yoga solo lee el `flex` del hijo directo
 * de la fila, que es el `Pressable`. Este reparto es lo que decide qué va a cada capa.
 */
describe('reparto del estilo de un Pulsable entre el Pressable y la vista de dentro', () => {
  test('el segmento del periodo: el flex sale a la caja de fuera y el aspecto se queda dentro', () => {
    // El estilo real de `Segmentado.s.segmento`, el que dejaba el fondo fuera de "7 días".
    const { externo, interno } = repartirEstilo({
      flex: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    });
    expect(externo).toEqual({ flex: 1, minHeight: 38 });
    expect(interno).toEqual({ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 });
  });

  test('todo lo que coloca la caja en su padre sale fuera, sin dejar nada dentro', () => {
    const colocacion: ViewStyle = {
      flexGrow: 1,
      flexShrink: 0,
      flexBasis: 0,
      alignSelf: 'flex-start',
      width: '62%',
      height: 120,
      minWidth: 44,
      maxWidth: 200,
      maxHeight: 300,
      aspectRatio: 1,
      margin: 1,
      marginTop: 2,
      marginBottom: 3,
      marginLeft: 4,
      marginRight: 5,
      marginHorizontal: -12,
      marginVertical: 6,
      marginStart: 7,
      marginEnd: 8,
      marginBlock: 9,
      marginInline: 10,
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      start: 0,
      end: 0,
      inset: 0,
      zIndex: 2,
      display: 'none',
    };
    const { externo, interno } = repartirEstilo(colocacion);
    expect(externo).toEqual(colocacion);
    expect(interno).toEqual({});
  });

  test('lo que se ve y lo que ordena a los hijos se queda dentro, incluida la opacidad de "apagado"', () => {
    // La opacidad tiene que quedarse con la escala del pulso, que vive en la vista de dentro: si
    // se fuera fuera, un botón apagado (`botonApagado`, `enviarApagado`) dejaría de verse apagado.
    const aspecto: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: '#000',
      borderRadius: 22,
      borderTopWidth: 1,
      borderTopColor: 'transparent',
      opacity: 0.4,
      overflow: 'hidden',
      transform: [{ rotate: '45deg' }],
    };
    const { externo, interno } = repartirEstilo(aspecto);
    expect(externo).toEqual({});
    expect(interno).toEqual(aspecto);
  });

  test('aplana arrays anidados con condicionales falsas y el último gana, como StyleSheet.flatten', () => {
    // La forma habitual en la app: `[s.boton, ocupado && s.apagado]`.
    const boton: ViewStyle = { minHeight: 44, marginBottom: 8, backgroundColor: '#0f0' };
    const apagado: ViewStyle = { opacity: 0.4 };
    const { externo, interno } = repartirEstilo([
      boton,
      false,
      undefined,
      null,
      [apagado, { marginBottom: 0 }],
    ]);
    expect(externo).toEqual({ minHeight: 44, marginBottom: 0 });
    expect(interno).toEqual({ backgroundColor: '#0f0', opacity: 0.4 });
  });

  test('sin estilo, las dos partes están vacías', () => {
    expect(repartirEstilo(undefined)).toEqual({ externo: {}, interno: {} });
    expect(repartirEstilo(null)).toEqual({ externo: {}, interno: {} });
    expect(repartirEstilo(false)).toEqual({ externo: {}, interno: {} });
    expect(repartirEstilo([])).toEqual({ externo: {}, interno: {} });
  });

  test('no se pierde ni se duplica ninguna propiedad', () => {
    const estilo: ViewStyle = {
      flex: 1,
      minHeight: 44,
      marginTop: 16,
      alignItems: 'center',
      padding: 8,
      backgroundColor: '#fff',
    };
    const { externo, interno } = repartirEstilo(estilo);
    expect({ ...externo, ...interno }).toEqual(estilo);
    for (const clave of Object.keys(externo)) {
      expect(interno).not.toHaveProperty(clave);
    }
  });
});
