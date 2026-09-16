import { RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hapticaMedia } from './haptica';
import { tema } from '../tema';

/**
 * Control de "tirar para actualizar", configurado igual en todas las pantallas.
 *
 * ⛔⛔ EXISTE PARA ARREGLAR UN FALLO QUE HACÍA QUE EL GESTO PARECIERA NO FUNCIONAR, y la causa no
 * era el gesto: era `progressViewOffset`.
 *
 * El `RefreshControl` de iOS pinta su rueda en el borde superior del `ScrollView`, o sea en y=0.
 * Y todas las pantallas de esta app reservan el hueco de la isla dinámica en el CONTENIDO, no en
 * el propio scroll. Resultado: la rueda aparecía DEBAJO de la isla dinámica, tapada por el
 * hardware.
 *
 * El gesto funcionaba y los datos se recargaban, pero no había ninguna señal visible de que
 * estuviera pasando algo, que a efectos del usuario es exactamente lo mismo que estar roto. Es el
 * tipo de fallo que solo aparece en el dispositivo: en un simulador sin notch la rueda se ve
 * perfectamente.
 *
 * ⇒ `progressViewOffset` baja la rueda hasta debajo de la isla. Y va aquí, en un componente
 * compartido, porque estaba repetido en seis pantallas y así el arreglo no se puede olvidar en la
 * séptima.
 *
 * ⭐ Desde el 15 sep el offset sale de `useSafeAreaInsets().top` (antes una constante de 56 que
 * fallaba en más de un iPhone), y al soltar el gesto hay un toque háptico medio: es el momento
 * en que el sistema toma el relevo del dedo, y Apple lo marca así en sus propias apps.
 */

type Props = {
  /** true mientras se está cargando. Es lo que mantiene la rueda girando. */
  cargando: boolean;
  onRecargar: () => void;
  /**
   * Pantallas que NO reservan el hueco de la isla dinámica.
   *
   * ⚠️ Es el caso de las que se abren como modal (Amigos, Diagnóstico): ahí el hueco de arriba lo
   * pone el botón de volver de `App.tsx`, así que el scroll ya empieza por debajo de la isla y
   * aplicar el offset otra vez bajaría la rueda hasta la mitad de la pantalla.
   */
  pegado?: boolean;
};

export function Recarga({ cargando, onRecargar, pegado = false }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <RefreshControl
      refreshing={cargando}
      onRefresh={() => {
        hapticaMedia();
        onRecargar();
      }}
      // Color de la rueda en iOS. Sin esto sale gris del sistema, que sobre este fondo casi
      // negro apenas se distingue.
      tintColor={tema.color.marca}
      // Color en Android: allí la rueda va dentro de un círculo con fondo propio.
      colors={[tema.color.marca]}
      progressBackgroundColor={tema.color.superficie}
      // ⭐ El arreglo: baja la rueda por debajo de la isla dinámica.
      progressViewOffset={pegado ? 0 : insets.top}
    />
  );
}
