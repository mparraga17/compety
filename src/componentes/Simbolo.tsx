import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol, type SymbolWeight } from 'expo-symbols';

import { tema } from '../tema';

/**
 * Icono del sistema: SF Symbols en iOS, con un respaldo de texto donde no existan.
 *
 * ⭐ Rediseno del 15 sep (regla 9e de `tema.ts`). Hasta ahora los iconos eran glifos dibujados
 * con Views (`Glifo`) y emojis de interfaz (👑 🏆 🔥 📍 🛡️). Los glifos eran la solucion correcta
 * cuando un modulo nativo costaba un build; con el build ya en marcha, `expo-symbols` trae los
 * iconos que el usuario ve en el resto del iPhone: mismo trazo, mismos pesos opticos que la
 * letra del sistema, y se tintan con cualquier color del tema. Es lo que mas "nativa" hace
 * parecer una app y lo que menos se sabe nombrar.
 *
 * ⚠️ Los emojis de DEPORTE (🏃 🎾 🏋️) NO pasan por aqui: los aprobo el usuario en la maqueta y
 * llevan color e identidad que un simbolo monocromo no da. Solo se sustituyen los de interfaz,
 * que al lado de un nombre en la clasificacion se leian como un chat y no como una app.
 *
 * ⚠️ `expo-symbols` esta marcado como beta en la doc de SDK 57. Por eso este componente es la
 * UNICA puerta: si la libreria cambia, se toca un fichero. Y por eso lleva `respaldo`: en
 * Android y web no hay SF Symbols, y un nombre inexistente en iOS no pinta nada, asi que cada
 * uso declara que ensenar si el simbolo falta (el emoji de antes o un caracter).
 *
 * Nombres usados en la app, todos presentes desde iOS 16 (el minimo de Expo SDK 57):
 *   chart.bar.fill · heart.fill · moon.fill · list.bullet · crown.fill · trophy.fill ·
 *   flame.fill · mappin · shield.fill · chevron.down · chevron.right · checkmark ·
 *   info.circle · plus · key.fill · person.2.fill · lock.fill · paperplane.fill · xmark ·
 *   exclamationmark.triangle.fill
 */

type Props = {
  nombre: SFSymbol;
  /** Lado del cuadro, en puntos. 21 en la barra de pestanas, 14-16 en linea con texto. */
  tamano?: number;
  color?: string;
  /** Peso del trazo. `semibold` casa con etiquetas a 600; `regular` con el cuerpo. */
  peso?: SymbolWeight;
  /** Que pintar si el simbolo no existe en esta plataforma. Un emoji o un caracter. */
  respaldo?: string;
  /** Solo para el respaldo: nodo propio en vez de texto (el glifo dibujado de la barra). */
  respaldoNodo?: ReactNode;
  accesible?: boolean;
  etiqueta?: string;
};

/** Hay simbolos del sistema en esta plataforma. */
export const HAY_SIMBOLOS = Platform.OS === 'ios';

export function Simbolo({
  nombre,
  tamano = 16,
  color = tema.color.texto,
  peso = 'regular',
  respaldo,
  respaldoNodo,
  accesible = false,
  etiqueta,
}: Props) {
  if (!HAY_SIMBOLOS) {
    if (respaldoNodo !== undefined) return <>{respaldoNodo}</>;
    return (
      <View style={[s.caja, { width: tamano, height: tamano }]} accessible={accesible} accessibilityLabel={etiqueta}>
        <Text style={{ fontSize: Math.round(tamano * 0.8), color, lineHeight: tamano }}>{respaldo ?? '·'}</Text>
      </View>
    );
  }

  return (
    <SymbolView
      name={nombre}
      size={tamano}
      tintColor={color}
      weight={peso}
      resizeMode="scaleAspectFit"
      style={{ width: tamano, height: tamano }}
      accessible={accesible}
      accessibilityLabel={etiqueta}
      fallback={respaldoNodo ?? (respaldo !== undefined ? <Text style={{ fontSize: Math.round(tamano * 0.8), color }}>{respaldo}</Text> : undefined)}
    />
  );
}

const s = StyleSheet.create({
  caja: { alignItems: 'center', justifyContent: 'center' },
});
