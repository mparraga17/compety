import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Pulsable } from '../componentes/Pulsable';

import { CargaEstimada } from '../componentes/CargaEstimada';
import { Selector } from '../componentes/Selector';
import { ICONO, NOMBRE_EN, NOMBRE_ES, TIPOS, iconoDe, nombreDeTipo } from '../motor/actividades';
import type { PasoSesion, Sesion } from '../motor/sesiones';
import { nombreLiga } from '../i18n/ligas';
import { conValores, idiomaActual, textos, type Textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Frase de un paso del desglose, armada con las cifras del motor.
 *
 * ⛔ El motor ya no devuelve la frase hecha. Antes sí, escrita en español, y con la app en inglés
 * el desglose salía en español. Un dato nunca lleva texto traducible dentro.
 */
function frasePaso(paso: PasoSesion, t: Textos): string {
  switch (paso.clave) {
    case 'intensidadMedida':
      return conValores(t.pasoIntensidadMedida, paso.datos);
    case 'intensidadDeclarada':
      return conValores(t.pasoIntensidadDeclarada, paso.datos);
    case 'intensidadTipica':
      return conValores(
        // `propia` dice si hay muestra de ESE deporte o si se usa la mediana global.
        paso.datos.propia === 1 ? t.pasoIntensidadTipica : t.pasoIntensidadParecida,
        paso.datos,
      );
    case 'factorModalidad':
      return conValores(t.pasoFactorModalidad, paso.datos);
    case 'volumen':
      return conValores(t.pasoVolumen, paso.datos);
    case 'descuentoSinPulso':
      return conValores(t.pasoDescuentoSinPulso, paso.datos);
    case 'contraTuBase':
      return paso.datos.media === undefined
        ? t.pasoSinHistorial
        : conValores(t.pasoContraTuBase, {
            ...paso.datos,
            signo: paso.datos.z >= 0 ? '+' : '',
          });
  }
}

/**
 * Hoja de desglose de una sesión: por qué estos puntos.
 *
 * ⭐ Responde al hallazgo del estudio JAMIA 2023 con 18 usuarios reales de Fitbit: los scores
 * opacos son el mayor problema de confianza de estas apps. Si la cifra no se puede justificar,
 * la gente deja de creerla y se va.
 *
 * No hay que calcular nada aquí. `Sesion.pasos` ya trae el desglose en lenguaje llano, paso a
 * paso, porque el motor lo genera junto al número. Esta pantalla solo lo pinta.
 *
 * ⭐ Y aquí vive el deslizador de esfuerzo (`CargaEstimada`), que es la pieza que arregla las
 * sesiones sin pulso. Sin ella una clase de barre sin pulsera puntúa estimada y no hay forma de
 * corregirla, que es justo castigar a quien la evidencia dice no castigar.
 */

type Props = {
  sesion: Sesion | null;
  onCerrar: () => void;
  onDeclararEsfuerzo: (idSesion: string, rpe: number) => void;
  /** Corrige el deporte de la sesión y vuelve a calcular. Lo resuelve App.tsx. */
  onCorregirDeporte: (idSesion: string, tipo: string) => void;
};

export function DetalleSesion({ sesion, onCerrar, onDeclararEsfuerzo, onCorregirDeporte }: Props) {
  const idioma = idiomaActual();
  const t = textos(idioma);

  /** Las opciones del corrector, ordenadas por su nombre en el idioma de la app. */
  const nombres = idioma === 'es' ? NOMBRE_ES : NOMBRE_EN;
  const opcionesDeporte = [...TIPOS]
    .sort((a, b) => nombres[a].localeCompare(nombres[b]))
    .map((tipo) => ({ id: tipo as string, nombre: `${ICONO[tipo]}  ${nombres[tipo]}` }));

  return (
    <Modal
      visible={sesion !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCerrar}
    >
      {sesion !== null && (
        <View style={s.hoja}>
          <ScrollView contentContainerStyle={s.contenido}>
            <View style={s.agarre} />

            <View style={s.cabecera}>
              <Text style={s.icono}>{iconoDe(sesion.tipo)}</Text>
              <View style={s.cabeceraTexto}>
                <Text style={s.titulo}>{nombreDeTipo(sesion.tipo, idioma)}</Text>
                <Text style={s.sub}>
                  {sesion.minutos} min
                  {sesion.metros !== null && sesion.metros > 0
                    ? ` · ${(sesion.metros / 1000).toFixed(2)} km`
                    : ''}
                  {sesion.fcMedia !== null ? ` · ${sesion.fcMedia} lpm` : ''}
                </Text>
              </View>
              <View style={s.cifra}>
                <Text style={s.puntos}>{sesion.puntos}</Text>
                <Text style={s.unidad}>{t.puntos}</Text>
              </View>
            </View>

            {/* El desglose paso a paso. Cada línea es una regla del motor en lenguaje llano. */}
            <Text style={s.seccion}>{t.porQueEstosPuntos}</Text>
            {sesion.pasos.map((paso, i) => (
              <View key={i} style={s.paso}>
                <Text style={s.pasoNumero}>{i + 1}</Text>
                <Text style={s.pasoTexto}>{frasePaso(paso, t)}</Text>
              </View>
            ))}

            <View style={s.resumen}>
              <View>
                <Text style={s.datoClave}>{t.carga}</Text>
                <Text style={s.datoValor}>{sesion.carga}</Text>
              </View>
              {sesion.liga !== null && (
                <View>
                  <Text style={s.datoClave}>{t.compiteEn}</Text>
                  <Text style={s.datoValor}>{nombreLiga(sesion.liga, idioma)}</Text>
                </View>
              )}
            </View>

            {/*
              ⭐ Por qué esta sesión cuenta en la general aunque sea de otro deporte. Lo pidió el
              usuario el 26 ago: *"¿Cómo que el golf no debe sumar a la general? Yo creo que sí,
              pero con sus pesos"*. Ninguna liga queda fuera, y el equilibrio lo dan el peso MET
              de cada deporte y que las horas de más pesen menos.
            */}
            {sesion.liga !== null && (
              <Text style={s.nota}>{t.compiteEnTexto}</Text>
            )}

            {/* ⚠️ Se dice cuando la sesión se fusionó y con qué fuentes. Si no, ver una sola
                sesión donde registraste dos parece un dato perdido. */}
            {sesion.fuentes.length > 1 && (
              <Text style={s.nota}>
                {conValores(t.fusionadaCon, { fuentes: sesion.fuentes.join(', ') })}
              </Text>
            )}

            {/*
              ⭐ El corrector de deporte. Existe por un hecho medido (8 sep): Fitbit escribe
              las pesas en Apple Health como "otro" (código 3000) aunque en su app tengan
              deporte. El dato llega roto de origen, así que se corrige aquí: al elegir, la
              sesión se vuelve a puntuar con los pesos del deporte real y compite en su liga.
              La corrección vive en el teléfono y sobrevive a cada relectura de HealthKit.
            */}
            <Text style={s.seccion}>{t.deporteDeSesion}</Text>
            <Selector
              etiqueta={t.deporteDeSesion}
              valor={sesion.tipo ?? 'SPORT'}
              onCambio={(tipo) => onCorregirDeporte(sesion.id, tipo)}
              opciones={opcionesDeporte}
            />
            <Text style={s.nota}>{t.deporteDeSesionTexto}</Text>

            {/* El deslizador. Solo aparece si la carga no se midió con pulso. */}
            <CargaEstimada
              origen={sesion.origen}
              onDeclararEsfuerzo={(rpe) => onDeclararEsfuerzo(sesion.id, rpe)}
            />

            <Pulsable style={s.cerrar} onPress={onCerrar} accessibilityRole="button">
              <Text style={s.cerrarTexto}>{t.cerrar}</Text>
            </Pulsable>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  hoja: { flex: 1, backgroundColor: tema.color.fondo },
  contenido: {
    paddingHorizontal: tema.espacio.l,
    paddingTop: tema.espacio.m,
    paddingBottom: tema.espacio.xl,
  },
  agarre: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(230,236,233,0.18)',
    alignSelf: 'center',
    marginBottom: tema.espacio.l,
  },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: tema.espacio.s },
  icono: { fontSize: 26 },
  cabeceraTexto: { flex: 1 },
  titulo: { ...tema.tipo.titulo, fontSize: 24, color: tema.color.texto },
  sub: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginTop: 2 },
  cifra: { alignItems: 'flex-end' },
  puntos: { fontSize: 34, fontWeight: '300', color: tema.color.texto, letterSpacing: -1 },
  unidad: { fontSize: 10, color: tema.color.textoSuave },

  seccion: {
    ...tema.tipo.seccion,
    color: tema.color.textoSuave,
    marginTop: tema.espacio.l,
    marginBottom: tema.espacio.s,
  },
  paso: { flexDirection: 'row', gap: tema.espacio.s, marginBottom: tema.espacio.s },
  pasoNumero: {
    ...tema.tipo.detalle,
    color: tema.color.textoSuave,
    width: 16,
    textAlign: 'right',
  },
  pasoTexto: { ...tema.tipo.detalle, color: tema.color.texto, flex: 1, lineHeight: 19 },

  resumen: { flexDirection: 'row', gap: tema.espacio.xl, marginTop: tema.espacio.m },
  datoClave: { ...tema.tipo.detalle, color: tema.color.textoSuave },
  datoValor: { fontSize: 18, fontWeight: '600', color: tema.color.texto },
  nota: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginTop: tema.espacio.m },

  cerrar: {
    minHeight: tema.tactil,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tema.espacio.m,
  },
  cerrarTexto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave },
});
