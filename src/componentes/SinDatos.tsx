import { Pressable, StyleSheet, Text, View } from 'react-native';

import { abrirAjustes } from '../salud/estado';
import { textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Lo que se muestra cuando una consulta vuelve vacia.
 *
 * iOS no permite saber si el usuario denego un permiso de lectura, asi que aqui no
 * se afirma nada: se dan las dos posibilidades y un boton para revisar Ajustes.
 * Mismo criterio que en el panel: un hueco no es un cero.
 */

type Props = {
  /** true cuando el vacio es de frecuencia cardiaca, que tiene texto propio. */
  frecuenciaCardiaca?: boolean;
};

export function SinDatos({ frecuenciaCardiaca = false }: Props) {
  const t = textos();

  return (
    <View style={s.caja}>
      {!frecuenciaCardiaca && <Text style={s.titulo}>{t.sinDatosTitulo}</Text>}
      <Text style={s.cuerpo}>
        {frecuenciaCardiaca ? t.sinDatosFc : t.sinDatosCuerpo}
      </Text>
      <Pressable onPress={abrirAjustes} accessibilityRole="button">
        <Text style={s.accion}>{t.revisarPermisos}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  caja: { gap: tema.espacio.s, paddingVertical: tema.espacio.m },
  titulo: { ...tema.tipo.cuerpo, color: tema.color.texto, fontWeight: '600' },
  cuerpo: { ...tema.tipo.detalle, color: tema.color.textoSuave, lineHeight: 19 },
  accion: { ...tema.tipo.detalle, color: tema.color.marca, fontWeight: '600' },
});
