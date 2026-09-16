import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Pulsable } from './Pulsable';
import { RESORTE, useReducirMovimiento } from '../movimiento';
import { tema } from '../tema';

/**
 * Control segmentado, el de iOS: todas las opciones a la vista y la elegida con fondo.
 *
 * ⭐ Rediseño del 15 sep. El periodo de la clasificación (semana, mes, año) era un desplegable
 * que abría una hoja desde abajo para elegir entre tres cosas: un viaje para una decisión de un
 * toque, y un desajuste espacial (el control arriba, la lista abajo). Con tres o cuatro opciones
 * cortas, el control segmentado es manipulación directa: ves las tres, tocas una, cambia. Apple:
 * *"place a control near what it affects"*; aquí el control ES la elección.
 *
 * ⚠️ Solo para 2-4 opciones cortas. El selector de liga (hasta ocho nombres largos) sigue siendo
 * un desplegable, que es lo correcto para una lista.
 *
 * El fondo de la elegida se DESPLAZA con un resorte crítico (`RESORTE.vivo`, sin rebote:
 * responde a un toque, no a un lanzamiento) en vez de saltar: es lo que hace que el control se
 * sienta como una pieza y no como tres botones. Con "Reducir movimiento" salta.
 */

export type Segmento<T extends string> = { id: T; nombre: string };

type Props<T extends string> = {
  opciones: readonly Segmento<T>[];
  valor: T;
  onCambio: (id: T) => void;
  etiqueta?: string;
};

export function Segmentado<T extends string>({ opciones, valor, onCambio, etiqueta }: Props<T>) {
  const reducir = useReducirMovimiento();
  const indice = Math.max(0, opciones.findIndex((o) => o.id === valor));
  const [ancho, setAncho] = useState(0);
  const x = useRef(new Animated.Value(indice)).current;

  useEffect(() => {
    if (reducir) {
      x.setValue(indice);
      return;
    }
    Animated.spring(x, { toValue: indice, ...RESORTE.vivo }).start();
  }, [x, indice, reducir]);

  const anchoSegmento = ancho > 0 ? (ancho - 2 * RELLENO) / opciones.length : 0;

  return (
    <View
      style={s.pista}
      accessibilityRole="tablist"
      accessibilityLabel={etiqueta}
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
    >
      {anchoSegmento > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.elegida,
            {
              width: anchoSegmento,
              transform: [{ translateX: Animated.multiply(x, anchoSegmento) }],
            },
          ]}
        />
      )}
      {opciones.map((o) => {
        const activa = o.id === valor;
        return (
          <Pulsable
            key={o.id}
            fila
            style={s.segmento}
            onPress={() => onCambio(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
          >
            <Text style={[s.texto, activa && s.textoActivo]} numberOfLines={1}>
              {o.nombre}
            </Text>
          </Pulsable>
        );
      })}
    </View>
  );
}

/** Aire entre el borde de la pista y el fondo de la elegida. */
const RELLENO = 3;

const s = StyleSheet.create({
  pista: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: tema.tactil,
    padding: RELLENO,
    borderRadius: tema.radio.m,
    backgroundColor: tema.color.superficieSutil,
    position: 'relative',
  },
  // El fondo de la elegida: un bloque un punto más claro que la pista, sin borde.
  elegida: {
    position: 'absolute',
    top: RELLENO,
    bottom: RELLENO,
    left: RELLENO,
    borderRadius: tema.radio.m - RELLENO,
    backgroundColor: 'rgba(230,236,233,0.12)',
  },
  segmento: {
    flex: 1,
    minHeight: tema.tactil - 2 * RELLENO,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tema.espacio.s,
  },
  texto: { ...tema.tipo.detalle, color: tema.color.textoSuave },
  textoActivo: { color: tema.color.texto, fontWeight: '600' },
});
