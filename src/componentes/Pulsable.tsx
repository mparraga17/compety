import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CURVA, MS, useReducirMovimiento } from '../movimiento';

/**
 * Envoltorio que da feedback al PULSAR, no al soltar. Va en TODO lo que se pueda tocar.
 *
 * ⭐ Regla que sale de las dos skills de diseño y que la app cumplía en dos sitios de treinta:
 *
 *   Apple (`apple-design`): *"Respond on pointer-down, not on release. Waiting for click/touch-up
 *   to show feedback feels dead."* Y añade el porqué: en cuanto aparece retraso, la sensación de
 *   manejar algo directamente *"falls off a cliff"*.
 *
 *   Emil (`emil-design-eng`): *"Buttons must feel responsive. Add `transform: scale(0.97)` on
 *   `:active`. This gives instant feedback, making the UI feel like it is truly listening."*
 *
 * Es la diferencia entre una interfaz que contesta y una que parece congelada. Y explica parte de
 * por qué la app se sentía "tosca" al lado de la maqueta: en el navegador el `:active` es gratis,
 * en React Native hay que escribirlo uno por uno.
 *
 * ⚠️ `useNativeDriver: true` es lo que saca la animación del hilo de JavaScript. Sin eso la escala
 * se atasca justo cuando la app está recalculando el motor, que es exactamente el momento en que
 * el usuario está tocando cosas. Con el driver nativo el toque responde aunque JS esté ocupado.
 *
 * ⚠️ Y las duraciones son distintas a propósito: 90 ms al pulsar y 160 al soltar. Es el patrón
 * asimétrico que señala Emil, *"slow where the user is deciding, fast where the system is
 * responding"*, aplicado donde toca: el acuse de recibo tiene que ser inmediato porque ahí hay
 * alguien esperando, y la vuelta puede relajarse porque ya no espera nadie.
 */

type Props = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Cuánto se hunde. 0,97 es el valor de la skill: se nota y no distrae. */
  escala?: number;
  /**
   * Para filas de una lista y elementos anchos.
   *
   * ⭐ Una fila a todo lo ancho no se puede escalar: al hundirse deja ver el fondo por los lados y
   * se lee como un fallo de dibujo, no como una respuesta. Es lo mismo que hace iOS, que hunde los
   * botones y solo cambia el fondo de las filas de una tabla.
   */
  fila?: boolean;
};

export function Pulsable({ children, style, escala = 0.97, fila = false, ...resto }: Props) {
  const v = useRef(new Animated.Value(0)).current;
  const reducir = useReducirMovimiento();

  const a = (hacia: number, ms: number) =>
    Animated.timing(v, {
      toValue: hacia,
      duration: ms,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start();

  /**
   * ⚠️ Con movimiento reducido se cambia la escala por opacidad, NO se quita el feedback.
   *
   * Apple: *"Reduced motion doesn't mean no feedback — it means a gentler, non-vestibular
   * equivalent."* Quitarlo del todo dejaría a esa persona sin saber si la app registró el toque,
   * que es peor que el mareo que se intentaba evitar.
   */
  const estiloPulso =
    reducir || fila
      ? { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }
      : {
          transform: [
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, escala] }) },
          ],
        };

  return (
    <Pressable
      onPressIn={() => a(1, MS.pulso)}
      onPressOut={() => a(0, MS.suelta)}
      {...resto}
    >
      <Animated.View style={[style, estiloPulso]}>{children}</Animated.View>
    </Pressable>
  );
}
