import { useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Halo } from '../componentes/Halo';
import { Hoja } from '../componentes/Hoja';
import { Marca } from '../componentes/Marca';
import { Pulsable } from '../componentes/Pulsable';
import { Simbolo } from '../componentes/Simbolo';

import { hayHealthKit, preparar } from '../salud/permisos';
import { textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Pantalla previa a la hoja de permisos del sistema.
 *
 * No es cortesia: Apple rechaza apps que usan HealthKit sin identificar la
 * funcionalidad en la interfaz, y hay casos documentados en sus foros.
 * https://developer.apple.com/forums/thread/802626
 *
 * Tres cosas tiene que quedar claras antes de que iOS pregunte: que se lee,
 * para que, y donde acaba el dato.
 *
 * ⭐ Rediseño del 15 sep: era un muro de texto (título de 22 y siete párrafos) y es lo PRIMERO
 * que ve alguien nuevo. Ahora sigue el patrón de bienvenida de iOS: la marca con el halo arriba,
 * título grande, una fila por idea (símbolo del sistema + titular con peso + detalle), y el
 * botón anclado abajo. Todos los textos que exigía Apple siguen aquí; lo que cambia es que se
 * pueden leer de un vistazo. El aviso de "no es médica" va en texto suave con el símbolo en
 * coral: es información legal, no un dato "peor", y el coral pleno en un párrafo satura.
 */

type Props = { onListo: () => void; onSaltar: () => void };

export function Bienvenida({ onListo, onSaltar }: Props) {
  const t = textos();
  const insets = useSafeAreaInsets();
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La hoja con el detalle de qué ven los demás. Abierta desde la fila de privacidad.
  const [detallePrivacidad, setDetallePrivacidad] = useState(false);
  const disponible = hayHealthKit();

  async function pedir() {
    setPidiendo(true);
    setError(null);
    try {
      await preparar();
      onListo();
    } catch {
      // Si la hoja falla, no se bloquea al usuario: puede seguir y reintentar.
      setError(t.sinDatosCuerpo);
    } finally {
      setPidiendo(false);
    }
  }

  return (
    <ScrollView
      style={s.fondo}
      contentContainerStyle={[
        s.contenido,
        { paddingTop: insets.top + tema.espacio.xl, paddingBottom: Math.max(insets.bottom, tema.espacio.l) },
      ]}
    >
      <Halo />
      <Marca lado={64} entra />
      <Text style={s.titulo}>{t.bienvenidaTitulo}</Text>
      <Text style={s.entrada}>{t.bienvenidaEntrada}</Text>

      <View style={s.filas}>
        <Caracteristica simbolo="figure.run" respaldo="🏃" titulo={t.queLeemosSesiones} detalle={t.queLeemosSesionesDetalle} />
        <Caracteristica simbolo="heart.fill" respaldo="♥" titulo={t.queLeemosFc} detalle={t.queLeemosFcDetalle} />
        <Caracteristica simbolo="waveform.path.ecg" respaldo="∿" titulo={t.queLeemosSalud} detalle={t.queLeemosSaludDetalle} />
        {/*
          ⭐ La fila de privacidad dice UNA cosa: qué sube y qué no (16 sep). Antes concatenaba
          también lo que ven los miembros de la liga y los amigos en el feed: unas sesenta palabras
          en una fila, que nadie lee en una pantalla que quiere pasar. Eso sigue aquí, a un toque, en
          una hoja: es lo que Apple exige que esté (y está), sin taparle el resto a quien no lo pida.
        */}
        <Caracteristica simbolo="lock.fill" respaldo="🔒" titulo={t.dondeVa} detalle={t.dondeVaDetalle}>
          <Pulsable style={s.enlace} onPress={() => setDetallePrivacidad(true)} accessibilityRole="button">
            <Text style={s.enlaceTexto}>{t.dondeVaMas}</Text>
            <Simbolo nombre="chevron.right" tamano={11} color={tema.color.marca} peso="semibold" respaldo="›" />
          </Pulsable>
        </Caracteristica>
      </View>

      <Hoja visible={detallePrivacidad} onCerrar={() => setDetallePrivacidad(false)} titulo={t.dondeVa}>
        <Text style={s.hojaTexto}>{t.dondeVaDetalle}</Text>
        <Text style={s.hojaTexto}>{t.dondeVaCompartido}</Text>
      </Hoja>

      <Text style={s.nota}>{t.puedesCambiar}</Text>

      {!disponible && <Aviso texto={t.sinHealthKit} />}
      {error !== null && <Aviso texto={error} />}

      {/* El hueco elástico: el botón se apoya abajo cuando la pantalla da, y baja con el
          contenido cuando no. */}
      <View style={s.hueco} />

      <Pulsable
        style={[s.boton, (!disponible || pidiendo) && s.botonInactivo]}
        onPress={pedir}
        disabled={!disponible || pidiendo}
        accessibilityRole="button"
        accessibilityLabel={t.continuar}
      >
        {pidiendo ? (
          <ActivityIndicator color={tema.color.fondo} />
        ) : (
          <Text style={s.botonTexto}>{t.continuar}</Text>
        )}
      </Pulsable>

      <Pulsable onPress={onSaltar} accessibilityRole="button">
        <Text style={s.saltar}>{t.masTarde}</Text>
      </Pulsable>
    </ScrollView>
  );
}

function Caracteristica({
  simbolo,
  respaldo,
  titulo,
  detalle,
  children,
}: {
  simbolo: SFSymbol;
  respaldo: string;
  titulo: string;
  detalle: string;
  /** Debajo del detalle: el enlace a "qué ven los demás" en la fila de privacidad. */
  children?: ReactNode;
}) {
  return (
    <View style={s.caracteristica}>
      <View style={s.icono}>
        <Simbolo nombre={simbolo} tamano={28} color={tema.color.marca} peso="medium" respaldo={respaldo} />
      </View>
      <View style={s.caracteristicaTextos}>
        <Text style={s.caracteristicaTitulo}>{titulo}</Text>
        <Text style={s.caracteristicaDetalle}>{detalle}</Text>
        {children}
      </View>
    </View>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <View style={s.aviso}>
      <Simbolo nombre="exclamationmark.triangle.fill" tamano={16} color={tema.color.bajo} respaldo="!" />
      <Text style={s.avisoTexto}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  contenido: { flexGrow: 1, paddingHorizontal: tema.espacio.l },
  // ⭐ Título GRANDE de bienvenida. No hay cifra que proteger: el título es el ancla.
  titulo: { ...tema.tipo.tituloGrande, color: tema.color.texto, marginTop: tema.espacio.l },
  entrada: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginTop: tema.espacio.s },
  filas: { marginTop: tema.espacio.l, gap: tema.espacio.l },
  caracteristica: { flexDirection: 'row', alignItems: 'flex-start', gap: tema.espacio.m },
  // Caja fija para el símbolo: los cuatro titulares alinean igual aunque el trazo varíe.
  icono: { width: 32, alignItems: 'center', marginTop: 2 },
  caracteristicaTextos: { flex: 1 },
  caracteristicaTitulo: { ...tema.tipo.destacado, color: tema.color.texto },
  caracteristicaDetalle: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginTop: 3 },
  // El enlace de la fila de privacidad: texto de marca con chevron, alto táctil, pegado a la izquierda.
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', minHeight: tema.tactil },
  enlaceTexto: { ...tema.tipo.detalle, color: tema.color.marca, fontWeight: '600' },
  hojaTexto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginBottom: tema.espacio.m },
  nota: { ...tema.tipo.detalle, color: tema.color.textoTenue, marginTop: tema.espacio.l },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: tema.espacio.s, marginTop: tema.espacio.m },
  avisoTexto: { ...tema.tipo.detalle, color: tema.color.textoSuave, lineHeight: 19, flex: 1 },
  hueco: { flex: 1, minHeight: tema.espacio.xl },
  // Cápsula, como los botones del sistema en iOS 26. Un poco más alta que el mínimo táctil.
  boton: {
    backgroundColor: tema.color.marca,
    borderRadius: 25,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botonInactivo: { opacity: 0.4 },
  botonTexto: { ...tema.tipo.destacado, color: tema.color.fondo },
  saltar: {
    ...tema.tipo.detalle,
    color: tema.color.textoSuave,
    textAlign: 'center',
    paddingVertical: tema.espacio.m,
    minHeight: tema.tactil,
  },
});
