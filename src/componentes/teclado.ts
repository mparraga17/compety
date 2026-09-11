import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Keyboard, Platform } from 'react-native';

/**
 * Altura del teclado como valor animado: 0 cerrado, su altura abierto. Para dejar hueco debajo
 * de una caja de texto que vive en una HOJA (`Modal` con `presentationStyle="pageSheet"`).
 *
 * ⛔⛔ Existe porque `KeyboardAvoidingView` NO funciona dentro de una hoja, y la caja de
 * comentarios quedaba tapada por el teclado (bug de TestFlight, 11 sep: "no ves lo que estás
 * escribiendo"). La causa es de cálculo: KAV toma su `y` del `onLayout`, que es relativo al
 * PADRE, y lo resta del borde del teclado, que va en coordenadas de PANTALLA. En una hoja el
 * contenido empieza ~50 px más abajo del borde de la ventana, así que la cuenta sale corta, o
 * directamente cero si el padre no mide lo que KAV espera.
 *
 * Aquí no hay que calcular nada: una hoja está pegada al borde inferior de la pantalla, así que
 * el trozo de hoja que tapa el teclado es exactamente la ALTURA del teclado. Se escucha
 * `keyboardWillChangeFrame`, que cubre abrir, cerrar y cambiar de tamaño (emojis, predictivo),
 * y se anima con la misma duración que anuncia iOS para ir al compás del teclado.
 *
 * Solo iOS: en Android la ventana se redimensiona sola (`softwareKeyboardLayoutMode: resize`) y
 * añadir hueco sería duplicarlo.
 */
export function useAlturaTeclado(): Animated.Value {
  const altura = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const sub = Keyboard.addListener('keyboardWillChangeFrame', (e) => {
      // Si el borde superior del teclado queda fuera de la pantalla, es que se está ocultando.
      const visible = e.endCoordinates.screenY < Dimensions.get('window').height;
      Animated.timing(altura, {
        toValue: visible ? e.endCoordinates.height : 0,
        duration: e.duration > 0 ? e.duration : 250,
        // `paddingBottom` no se puede animar en el hilo nativo.
        useNativeDriver: false,
      }).start();
    });
    return () => sub.remove();
  }, [altura]);

  return altura;
}
