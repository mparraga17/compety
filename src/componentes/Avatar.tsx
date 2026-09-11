import { StyleSheet, Text, View } from 'react-native';

import { tema } from '../tema';

/**
 * ⭐ Tonos de avatar por persona, deterministas por nombre.
 *
 * Antes todos los avatares eran el mismo círculo gris con inicial, y una tabla de siete círculos
 * idénticos se lee como una lista de datos, no como un grupo de gente. El tono es IDENTIDAD, no
 * jerarquía: la misma persona sale siempre del mismo color, y el rango lo siguen marcando el
 * metal del puesto y la barra, que son señales que no se pisan.
 *
 * ⚠️ La paleta esquiva a propósito los colores que ya significan algo: nada cercano al periwinkle
 * (`eres tú`), al coral (`peor`) ni a los tres metales. Todos a lightness parecida para que
 * ninguno grite, y usados a 0,15 de alpha en el fondo: el color de verdad solo lo lleva la
 * inicial, que contra el fondo oscuro pasa de 7:1 de contraste en los seis tonos.
 *
 * Vivía dentro de `Ligas.tsx`; salió a componente al nacer el feed, que pinta a la misma gente.
 */
const TONOS_AVATAR: readonly string[] = [
  '163,196,160', // salvia
  '226,169,178', // rosa palo
  '142,202,196', // turquesa apagado
  '138,176,214', // azul acero
  '196,160,200', // malva
  '186,192,140', // oliva
];

/** Tono estable para un nombre: mismo nombre, mismo color, sin estado que mantener. */
export function tonoAvatar(nombre: string): string {
  let h = 0;
  for (let i = 0; i < nombre.length; i += 1) h = (h * 31 + nombre.charCodeAt(i)) | 0;
  return TONOS_AVATAR[Math.abs(h) % TONOS_AVATAR.length];
}

type Props = {
  nombre: string;
  /** Inicial ya resuelta (con la regla de "tú" si aplica). Por defecto, la del nombre. */
  inicial?: string;
  /** "Eres tú": relleno de marca en vez del tono de identidad. Regla de la v2: sin bordes. */
  esYo?: boolean;
  /** Diámetro. 34 es el de la tabla de la liga. */
  tamano?: number;
};

export function Avatar({ nombre, inicial, esYo = false, tamano = 34 }: Props) {
  const tinte = tonoAvatar(nombre);
  const letra = inicial ?? nombre.trim().slice(0, 1).toUpperCase();
  return (
    <View
      style={[
        s.circulo,
        { width: tamano, height: tamano, borderRadius: tamano / 2 },
        { backgroundColor: `rgba(${tinte},0.15)` },
        esYo && s.yo,
      ]}
      accessibilityElementsHidden
    >
      <Text style={[s.letra, { fontSize: Math.round(tamano * 0.38) }, { color: `rgb(${tinte})` }, esYo && s.letraYo]}>
        {letra}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  circulo: {
    backgroundColor: tema.color.superficieSutil,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yo: { backgroundColor: 'rgba(198,203,240,0.16)' },
  letra: { fontWeight: '600', color: tema.color.textoSuave },
  letraYo: { color: tema.color.marca },
});
