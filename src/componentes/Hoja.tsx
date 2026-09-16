import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Pulsable } from './Pulsable';
import { idiomaActual, textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Hoja modal al estilo iOS. Es el contenedor de todo lo que se abre desde una pantalla:
 * desglose del día, detalle de sesión, fichas científicas y selectores.
 *
 * ⚠️ Existe porque el mismo bloque (modal, agarre, padding, botón de cerrar) estaba copiado en
 * cinco sitios con medidas ligeramente distintas, y eso es exactamente lo que hace que una
 * interfaz se sienta descuidada: las hojas no abrían iguales.
 */

type Props = {
  visible: boolean;
  onCerrar: () => void;
  /** Título grande. En una hoja SÍ puede ser grande: no compite con ninguna cifra. */
  titulo?: string;
  /** Texto de apoyo bajo el título. */
  sub?: string;
  children: ReactNode;
};

export function Hoja({ visible, onCerrar, titulo, sub, children }: Props) {
  const t = textos(idiomaActual());

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCerrar}
    >
      <View style={s.hoja}>
        <ScrollView contentContainerStyle={s.contenido}>
          <View style={s.agarre} />
          {titulo !== undefined && <Text style={s.titulo}>{titulo}</Text>}
          {sub !== undefined && <Text style={s.sub}>{sub}</Text>}

          {children}

          <Pulsable style={s.cerrar} onPress={onCerrar} accessibilityRole="button">
            <Text style={s.cerrarTexto}>{t.cerrar}</Text>
          </Pulsable>
        </ScrollView>
      </View>
    </Modal>
  );
}

export const estilosHoja = StyleSheet.create({
  /** Un bloque de la hoja, separado del siguiente. */
  bloque: { marginBottom: tema.espacio.l },
  /** Titular de un bloque. */
  dato: { ...tema.tipo.cuerpo, color: tema.color.texto, fontWeight: '600', marginBottom: 6 },
  /** Cuerpo de un bloque. */
  detalle: { ...tema.tipo.detalle, color: tema.color.textoSuave, lineHeight: 19 },
  /** Cita de la fuente. */
  fuente: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: 7 },
  enlace: {
    ...tema.tipo.micro,
    color: tema.color.marca,
    marginTop: 7,
    textDecorationLine: 'underline',
  },
});

const s = StyleSheet.create({
  hoja: { flex: 1, backgroundColor: tema.color.fondo },
  contenido: {
    paddingHorizontal: tema.espacio.l,
    paddingTop: tema.espacio.m,
    paddingBottom: tema.espacio.xl,
  },
  // Tirador de la hoja. Igual en todas: era una de las medidas que variaba entre copias.
  agarre: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: tema.color.tirador,
    alignSelf: 'center',
    marginBottom: tema.espacio.l,
  },
  // Con aire debajo, para cuando no hay subtítulo (el selector): sin él las opciones se
  // pegaban al título.
  titulo: {
    fontSize: 22,
    fontWeight: '600',
    color: tema.color.texto,
    letterSpacing: -0.4,
    marginBottom: tema.espacio.s,
  },
  sub: { ...tema.tipo.sub, color: tema.color.textoTenue, marginBottom: tema.espacio.m },
  cerrar: {
    minHeight: tema.tactil,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tema.espacio.l,
  },
  cerrarTexto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave },
});
