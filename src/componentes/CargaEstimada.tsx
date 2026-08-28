import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Carga } from '../motor/cargaSinFc';
import { textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Aviso cuando una sesion puntua sin haber medido el pulso.
 *
 * La sesion SI puntua, con un descuento declarado. Y se dice, porque convierte una
 * limitacion en un incentivo y encima es verdad. El estudio JAMIA senala los scores
 * opacos como el mayor problema de confianza, asi que el origen de cada punto se muestra.
 */

type Props = {
  carga: Carga;
  onDeclararEsfuerzo: (rpe: number) => void;
};

export function CargaEstimada({ carga, onDeclararEsfuerzo }: Props) {
  const t = textos();
  const [rpe, setRpe] = useState<number | null>(null);

  if (carga.origen === 'medida') return null;

  return (
    <View style={s.caja}>
      <Text style={s.titulo}>{t.cargaEstimada}</Text>
      <Text style={s.cuerpo}>{t.cargaEstimadaCuerpo}</Text>

      {carga.origen === 'estimada' && (
        <View style={s.esfuerzo}>
          <Text style={s.pregunta}>{t.comoDeDura}</Text>
          <View style={s.escala}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Pressable
                key={n}
                onPress={() => setRpe(n)}
                style={[s.grado, rpe === n && s.gradoElegido]}
                accessibilityRole="button"
                accessibilityLabel={`${n} de 10`}
              >
                <Text style={[s.gradoTexto, rpe === n && s.gradoTextoElegido]}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.extremos}>
            <Text style={s.extremo}>{t.suave}</Text>
            <Text style={s.extremo}>{t.muyDura}</Text>
          </View>

          {rpe !== null && (
            <Pressable
              style={s.boton}
              onPress={() => onDeclararEsfuerzo(rpe)}
              accessibilityRole="button"
            >
              <Text style={s.botonTexto}>{t.guardarEsfuerzo}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/** Etiqueta de origen para mostrar junto a cada puntuacion. */
export function EtiquetaOrigen({ carga }: { carga: Carga }) {
  const t = textos();
  const etiqueta =
    carga.origen === 'medida'
      ? t.origenMedida
      : carga.origen === 'declarada'
        ? t.origenDeclarada
        : t.origenEstimada;

  return <Text style={s.origen}>{etiqueta}</Text>;
}

const s = StyleSheet.create({
  caja: { gap: tema.espacio.s, paddingVertical: tema.espacio.m },
  titulo: { ...tema.tipo.cuerpo, color: tema.color.texto, fontWeight: '600' },
  cuerpo: { ...tema.tipo.detalle, color: tema.color.textoSuave, lineHeight: 19 },
  esfuerzo: { gap: tema.espacio.s, marginTop: tema.espacio.s },
  pregunta: { ...tema.tipo.detalle, color: tema.color.texto },
  escala: { flexDirection: 'row', gap: tema.espacio.xs },
  grado: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: tema.radio.s,
    backgroundColor: '#1d1f26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradoElegido: { backgroundColor: tema.color.marca },
  gradoTexto: { ...tema.tipo.detalle, color: tema.color.textoSuave },
  gradoTextoElegido: { color: tema.color.fondo, fontWeight: '600' },
  extremos: { flexDirection: 'row', justifyContent: 'space-between' },
  extremo: { ...tema.tipo.detalle, color: tema.color.textoSuave, fontSize: 11 },
  boton: {
    backgroundColor: tema.color.marca,
    borderRadius: tema.radio.m,
    paddingVertical: tema.espacio.s + 2,
    alignItems: 'center',
    marginTop: tema.espacio.xs,
  },
  botonTexto: { ...tema.tipo.detalle, color: tema.color.fondo, fontWeight: '600' },
  origen: { ...tema.tipo.detalle, color: tema.color.textoSuave, fontSize: 11 },
});
