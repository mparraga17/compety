import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, useWindowDimensions } from 'react-native';

import { IMAGEN_MARCA } from './Marca';
import { CURVA, MS, RESORTE, useReducirMovimiento } from '../movimiento';
import { tema } from '../tema';

/**
 * El arranque: la marca sube hasta el centro, debajo aparece el lema y todo sale corriendo hacia
 * la derecha, descubriendo la app.
 *
 * ⭐ Petición del usuario (16 sep): *"la animación de bienvenida me parece un poco sosa. Que el
 * logo fuera de abajo hacia arriba, smooth, y al llegar al centro apareciera debajo una frase
 * rollo 'Compety with your friends', y que todo se vaya como corriendo a la derecha para darle
 * sensación de dinamismo y velocidad"*. Antes era la marca sola con un fundido, y la app aparecía
 * de golpe al decidirse la fase.
 *
 * Cómo está montado, y por qué así:
 *
 * - Es una CAPA por encima de la app, no una fase. La pantalla que toque (bienvenida, entrar o las
 *   pestañas) se monta debajo en cuanto `App` sabe a dónde ir, y la capa sale después. Así la
 *   salida descubre una app ya pintada, y no hay ni un fotograma en blanco entre las dos cosas.
 *   El fondo de la capa es el de la app, así que al desplazarse el borde no se ve: lo que se ve es
 *   la marca y el lema saliendo y la app "ya estaba ahí".
 * - La marca sube con `RESORTE.normal`, el resorte de "mover/recolocar" de Apple (respuesta 0,4,
 *   sin rebote): llega y se para. La opacidad termina antes que la posición para que no parezca
 *   que aparece de la nada.
 * - El lema entra a los 260 ms, cuando la marca ya casi se ha asentado, con la entrada estándar de
 *   la app (12 pt de subida, `CURVA.sale`). Y la capa se queda un mínimo (`MINIMO`) para que el
 *   lema se pueda leer: cuatro palabras necesitan medio segundo.
 * - La salida va con `CURVA.mueve`, que acelera: es lo que da la sensación de velocidad. Se
 *   desplaza más allá del ancho para que la parte visible del recorrido sea la que acelera, y se
 *   estira un 12 % en horizontal mientras corre, el "stretch" con el que la skill de Apple codifica
 *   la velocidad en vez de un rastro. Se funde en el último tramo para no cortar en seco. 280 ms:
 *   por debajo del techo de 300 del sistema de movimiento.
 * - Con "Reducir movimiento" no se desplaza nada: la marca y el lema se funden, y la capa se funde
 *   al salir. Es el criterio de toda la app: se quita el desplazamiento, se queda la opacidad.
 *
 * ⚠️ Coste asumido: cada arranque en frío dura al menos `MINIMO` + la salida (~1,2 s) aunque la
 * sesión ya esté. Antes la app aparecía en décimas de segundo. Es una decisión de marca del
 * usuario, y `MINIMO` es el número que hay que bajar si algún día pesa.
 *
 * ⚠️ La pantalla nativa de arranque (el storyboard de la plantilla de Expo, sin imagen y con el
 * color de fondo del sistema, negro en modo oscuro) sigue delante de esto. El primer fotograma
 * de la capa es fondo liso, así que el relevo negro → #14151a es imperceptible.
 */

type Props = {
  /** true cuando la app ya sabe a dónde ir. La salida no arranca antes, ni antes del mínimo. */
  listo: boolean;
  /** Al terminar la salida. El padre desmonta la capa. */
  onFin: () => void;
};

/**
 * El lema, en inglés en TODOS los idiomas (decisión del usuario, 16 sep): es una frase de marca,
 * como el nombre, no un texto de interfaz. Por eso no vive en i18n.
 */
const LEMA = 'Compety with your friends';
/** Lado de la marca. Un tercio del ancho de un iPhone: es la portada, no un icono. */
const LADO_MARCA = 128;
/** Desde cuántos puntos por debajo sube la marca. */
const SUBIDA = 56;
/** Cuándo entra el lema: la marca lleva el 65 % del recorrido y está frenando. */
const RETARDO_LEMA = 260;
/** Mínimo en pantalla antes de salir, para que el lema se lea. */
const MINIMO = 900;
/** Duración de la salida. Bajo el techo de 300 ms. */
const MS_SALIDA = 280;
/** Cuánto se estira en horizontal al salir: codifica la velocidad. */
const ESTIRON = 1.12;

export function Arranque({ listo, onFin }: Props) {
  const { width } = useWindowDimensions();
  const reducir = useReducirMovimiento();

  const marca = useRef(new Animated.Value(0)).current;
  const lema = useRef(new Animated.Value(0)).current;
  const salida = useRef(new Animated.Value(0)).current;
  const [enTiempo, setEnTiempo] = useState(false);
  const saliendo = useRef(false);

  // Entrada: la marca sube y el lema aparece debajo. El mínimo de lectura corre desde ya.
  useEffect(() => {
    if (reducir) {
      Animated.timing(marca, { toValue: 1, duration: 140, easing: CURVA.sale, useNativeDriver: true }).start();
      Animated.timing(lema, { toValue: 1, duration: 140, delay: 120, easing: CURVA.sale, useNativeDriver: true }).start();
    } else {
      Animated.spring(marca, { toValue: 1, ...RESORTE.normal }).start();
      Animated.timing(lema, {
        toValue: 1,
        duration: MS.entra,
        delay: RETARDO_LEMA,
        easing: CURVA.sale,
        useNativeDriver: true,
      }).start();
    }
    const temporizador = setTimeout(() => setEnTiempo(true), MINIMO);
    return () => clearTimeout(temporizador);
  }, [marca, lema, reducir]);

  // Salida: cuando la app sabe a dónde ir Y el lema ha tenido tiempo de leerse.
  useEffect(() => {
    if (!listo || !enTiempo || saliendo.current) return;
    saliendo.current = true;
    Animated.timing(salida, {
      toValue: 1,
      duration: reducir ? MS.cambia : MS_SALIDA,
      easing: reducir ? CURVA.sale : CURVA.mueve,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFin();
    });
  }, [listo, enTiempo, salida, reducir, onFin]);

  const estiloMarca = {
    // La opacidad termina al 40 % del recorrido: la marca es sólida mientras aún se asienta.
    opacity: marca.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: reducir
      ? []
      : [{ translateY: marca.interpolate({ inputRange: [0, 1], outputRange: [SUBIDA, 0] }) }],
  };
  const estiloLema = {
    opacity: lema,
    transform: reducir ? [] : [{ translateY: lema.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };
  const estiloSalida = reducir
    ? { opacity: salida.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
    : {
        // Se funde solo en el último tramo: primero corre, luego desaparece.
        opacity: salida.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateX: salida.interpolate({ inputRange: [0, 1], outputRange: [0, width * 1.25] }) },
          { scaleX: salida.interpolate({ inputRange: [0, 1], outputRange: [1, ESTIRON] }) },
        ],
      };

  return (
    <Animated.View style={[s.capa, estiloSalida]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.Image
        source={IMAGEN_MARCA}
        style={[s.marca, estiloMarca]}
        accessible={false}
        resizeMode="contain"
      />
      <Animated.Text style={[s.lema, estiloLema]}>{LEMA}</Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // Encima de todo lo que haya debajo, del color del fondo: al moverse, el borde no se ve.
  capa: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
    backgroundColor: tema.color.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marca: { width: LADO_MARCA, height: LADO_MARCA, tintColor: tema.color.marca },
  // El lema: peso medio, dos puntos más que el cuerpo (la marca es grande), en tinta suave.
  lema: { fontSize: 19, fontWeight: '500', letterSpacing: -0.3, color: tema.color.textoSuave, marginTop: tema.espacio.l },
});
