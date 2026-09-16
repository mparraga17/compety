import { useEffect, useRef, useState } from 'react';
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
 *
 * ⛔⛔ SEGUNDO FALLO ARREGLADO AQUÍ (16 sep): la rueda solo gira si el USUARIO tiró.
 *
 * Síntoma: al abrir la app y pasar de Competi a Hoy, *"se sube y se baja y se carga ahí en medio
 * una cosa rara"*. Y al abrir la ficha de un amigo, la cabecera bajaba y volvía a subir sola.
 *
 * Causa, leída en el nativo de RN 0.86 (`RCTPullToRefreshViewComponentView.mm`): cuando la prop
 * `refreshing` pasa a `true` SIN gesto, iOS tiene que enseñar la rueda de algún modo, y lo hace
 * desplazando el contenido hacia abajo la altura de la rueda (~60 pt) de golpe
 * (`beginRefreshingProgrammatically`: `setContentOffset` sin animar); al pasar a `false`,
 * `endRefreshing` lo devuelve arriba con animación. Y `layoutSubviews` lo repite en cada pasada de
 * layout mientras la prop siga en `true`. Todas las pantallas pasaban aquí su indicador GENERAL de
 * carga, así que la carga inicial (o la de fondo) movía la página sin que nadie hubiera tirado.
 *
 * ⇒ `refreshing` es `tirado && cargando`: se enciende en `onRefresh`, que solo dispara el gesto, y
 * se apaga cuando esa carga termina. En un tirón real la rueda ya está girando por el gesto, así
 * que el nativo no desplaza nada (`if (!isRefreshing)`). Las cargas que no vienen del dedo las
 * señala cada pantalla a su manera (su `ActivityIndicator`), como debe ser: la rueda es la
 * respuesta a un gesto, no un estado.
 */

type Props = {
  /** true mientras se está cargando. Mantiene la rueda girando SI el usuario tiró. */
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
  // Si el usuario tiró. Se apaga cuando la carga que siguió al tirón termina (true → false), no
  // en cualquier instante sin carga: así un `onRecargar` que tarde un tick en encender `cargando`
  // no pierde la rueda.
  const [tirado, setTirado] = useState(false);
  const cargaba = useRef(cargando);
  useEffect(() => {
    if (cargaba.current && !cargando) setTirado(false);
    cargaba.current = cargando;
  }, [cargando]);

  return (
    <RefreshControl
      refreshing={tirado && cargando}
      onRefresh={() => {
        setTirado(true);
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
