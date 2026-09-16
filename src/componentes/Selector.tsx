import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Hoja } from './Hoja';
import { Pulsable } from './Pulsable';
import { Simbolo } from './Simbolo';
import { CURVA, MS, useReducirMovimiento } from '../movimiento';
import { tema } from '../tema';

/**
 * Selector desplegable al estilo iOS.
 *
 * ⭐ Sustituye a las tiras horizontales, y el motivo es concreto: con 8 ligas las últimas
 * quedaban fuera del borde y había que arrastrar para verlas. Es lo que hacía que la captura del
 * usuario pareciera desalineada. La maqueta ya usaba dos `picker` con chevron por eso mismo.
 *
 * ⚠️ Con `Modal` propio y no con `@react-native-picker/picker`: ese paquete es un módulo nativo y
 * obligaría a recompilar. Es el mismo criterio del halo y de los iconos con emoji.
 */

export type Opcion<T extends string> = {
  id: T;
  nombre: string;
  /** Texto a la derecha. En las ligas es el número de participantes. */
  detalle?: string;
};

type Props<T extends string> = {
  /** Etiqueta pequeña encima del valor. */
  etiqueta?: string;
  opciones: readonly Opcion<T>[];
  valor: T;
  onCambio: (id: T) => void;
  /** El selector secundario va en texto más discreto, como en la maqueta. */
  suave?: boolean;
};

export function Selector<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  suave = false,
}: Props<T>) {
  const [abierto, setAbierto] = useState(false);
  const elegida = opciones.find((o) => o.id === valor);
  const reducir = useReducirMovimiento();
  const giro = useRef(new Animated.Value(0)).current;

  /**
   * ⭐ El chevron gira 180° mientras la hoja está abierta.
   *
   * Pasa el filtro de "¿para qué se anima?" de Emil con una respuesta concreta: es indicación de
   * estado. El chevron dice si la lista está desplegada, y girándolo esa relación se ve en vez de
   * haber que deducirla. Es de las animaciones que Apple llama *"hint in the direction of the
   * gesture"*: la punta apunta a donde va la lista.
   *
   * ⚠️ `CURVA.mueve` y no `sale`, porque el chevron no entra ni sale: está a la vista y se mueve.
   * Es la rama de "moving/morphing on screen" del árbol de decisión de la skill, y quiere una
   * curva que acelere y frene, no una que arranque disparada.
   */
  useEffect(() => {
    if (reducir) {
      giro.setValue(abierto ? 1 : 0);
      return;
    }
    Animated.timing(giro, {
      toValue: abierto ? 1 : 0,
      duration: MS.cambia,
      easing: CURVA.mueve,
      useNativeDriver: true,
    }).start();
  }, [giro, abierto, reducir]);

  if (opciones.length === 0) return null;

  return (
    <>
      <Pulsable
        style={s.control}
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${etiqueta ?? ''} ${elegida?.nombre ?? ''}`.trim()}
      >
        <Text style={suave ? s.valorSuave : s.valor} numberOfLines={1}>
          {elegida?.nombre ?? '·'}
        </Text>
        {/* El chevron del sistema. Antes dos vistas rotadas, de cuando un módulo nativo costaba
            un build. */}
        <Animated.View
          style={[
            s.chevron,
            {
              transform: [
                {
                  rotate: giro.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Simbolo nombre="chevron.down" tamano={12} color={tema.color.textoTenue} peso="semibold" respaldo="⌄" />
        </Animated.View>
      </Pulsable>

      {/*
        ⭐ Con el componente `Hoja` compartido, no con un Modal a mano. `Hoja` existe porque el
        mismo bloque estaba copiado en cinco sitios con medidas distintas, y este selector
        seguía siendo una de las copias.
      */}
      <Hoja visible={abierto} onCerrar={() => setAbierto(false)} titulo={etiqueta}>
        {opciones.map((o) => {
          const activa = o.id === valor;
          return (
            <Pulsable
              key={o.id}
              fila
              style={s.opcion}
              onPress={() => {
                onCambio(o.id);
                setAbierto(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: activa }}
            >
              {/* Marca de selección, no un fondo de color: la jerarquía la hace el peso
                  tipográfico. Regla de la v2 del panel. */}
              <View style={s.marca}>
                {activa && <Simbolo nombre="checkmark" tamano={14} color={tema.color.marca} peso="semibold" respaldo="✓" />}
              </View>
              <Text style={[s.opcionTexto, activa && s.opcionActiva]}>{o.nombre}</Text>
              {o.detalle !== undefined && <Text style={s.opcionDetalle}>{o.detalle}</Text>}
            </Pulsable>
          );
        })}
      </Hoja>
    </>
  );
}

const s = StyleSheet.create({
  // Fondo sutil, como el `.picker>button` de la maqueta. Sin fondo el selector no parecía
  // tocable, que es parte de por qué la pantalla se sentía tosca. Radio `m`, el de los controles.
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: tema.tactil,
    paddingHorizontal: 13,
    backgroundColor: tema.color.superficieSutil,
    borderRadius: tema.radio.m,
  },
  // Peso 500 como la maqueta, no 600: el selector no es un titular.
  valor: { fontSize: 15, fontWeight: '500', color: tema.color.texto, flexShrink: 1 },
  valorSuave: { ...tema.tipo.detalle, color: tema.color.textoSuave, flexShrink: 1 },
  chevron: { width: 12, height: 12, marginTop: 1 },

  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tema.espacio.s,
    minHeight: tema.tactil,
  },
  marca: { width: 14, alignItems: 'center' },
  opcionTexto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, flex: 1 },
  opcionActiva: { color: tema.color.texto, fontWeight: '500' },
  opcionDetalle: { ...tema.tipo.micro, color: tema.color.textoTenue, ...tema.cifras },
});
