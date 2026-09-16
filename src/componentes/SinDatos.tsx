import { StyleSheet, Text, View } from 'react-native';

import { Pulsable } from './Pulsable';
import { Simbolo } from './Simbolo';

import { abrirAjustes } from '../salud/estado';
import { textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Lo que se muestra cuando una consulta vuelve vacia.
 *
 * iOS no permite saber si el usuario denego un permiso de lectura, asi que aqui no
 * se afirma nada: se dan las dos posibilidades y un boton para revisar Ajustes.
 * Mismo criterio que en el panel: un hueco no es un cero.
 *
 * ⭐ Rediseño del 15 sep: es el estado vacío ÚNICO de las pestañas de datos. Hoy, Sesiones y
 * Sueño tenían cada una su línea suelta de 15 px sin ninguna acción, y Ligas y Feed otra
 * anatomía distinta. Apple: un estado vacío responde "qué hay aquí y cómo lo arreglo". Ahora:
 * símbolo, titular con peso, texto de apoyo y la acción en una cápsula secundaria. `titulo` y
 * `texto` se pueden sustituir por los de cada pantalla; la acción de revisar permisos se queda,
 * porque un vacío de HealthKit casi siempre acaba ahí.
 */

type Props = {
  /** true cuando el vacio es de frecuencia cardiaca, que tiene texto propio. */
  frecuenciaCardiaca?: boolean;
  /** Titular propio de la pantalla. Por defecto, el genérico de "sin datos". */
  titulo?: string;
  /** Texto de apoyo propio. */
  texto?: string;
};

export function SinDatos({ frecuenciaCardiaca = false, titulo, texto }: Props) {
  const t = textos();

  return (
    <View style={s.caja}>
      <Simbolo nombre="tray" tamano={28} color={tema.color.textoTenue} respaldo="◌" />
      {!frecuenciaCardiaca && <Text style={s.titulo}>{titulo ?? t.sinDatosTitulo}</Text>}
      <Text style={s.cuerpo}>{texto ?? (frecuenciaCardiaca ? t.sinDatosFc : t.sinDatosCuerpo)}</Text>
      <Pulsable onPress={abrirAjustes} accessibilityRole="button" style={s.boton}>
        <Text style={s.accion}>{t.revisarPermisos}</Text>
      </Pulsable>
    </View>
  );
}

const s = StyleSheet.create({
  caja: { gap: tema.espacio.s, paddingVertical: tema.espacio.l, alignItems: 'flex-start' },
  titulo: { ...tema.tipo.destacado, color: tema.color.texto, marginTop: tema.espacio.xs },
  cuerpo: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, maxWidth: 320 },
  // Cápsula secundaria: fondo sutil, texto de marca. La misma que las acciones de Competi.
  boton: {
    marginTop: tema.espacio.s,
    minHeight: tema.tactil,
    paddingHorizontal: tema.espacio.l,
    borderRadius: tema.tactil / 2,
    backgroundColor: tema.color.superficieSutil,
    justifyContent: 'center',
  },
  accion: { ...tema.tipo.cuerpo, color: tema.color.marca, fontWeight: '600' },
});
