import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
 */

type Props = { onListo: () => void; onSaltar: () => void };

export function Bienvenida({ onListo, onSaltar }: Props) {
  const t = textos();
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    <ScrollView style={s.fondo} contentContainerStyle={s.contenido}>
      <Text style={s.titulo}>{t.bienvenidaTitulo}</Text>
      <Text style={s.entrada}>{t.bienvenidaEntrada}</Text>

      <Text style={s.seccion}>{t.queLeemos}</Text>
      <Punto titulo={t.queLeemosSesiones} detalle={t.queLeemosSesionesDetalle} />
      <Punto titulo={t.queLeemosFc} detalle={t.queLeemosFcDetalle} />
      <Punto titulo={t.queLeemosSalud} detalle={t.queLeemosSaludDetalle} />

      <Text style={s.seccion}>{t.dondeVa}</Text>
      <Text style={s.cuerpo}>{t.dondeVaDetalle}</Text>
      <Text style={s.cuerpo}>{t.dondeVaCompartido}</Text>

      <Text style={s.nota}>{t.puedesCambiar}</Text>

      {!disponible && <Text style={s.aviso}>{t.sinHealthKit}</Text>}
      {error !== null && <Text style={s.aviso}>{error}</Text>}

      <Pressable
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
      </Pressable>

      <Pressable onPress={onSaltar} accessibilityRole="button">
        <Text style={s.saltar}>{t.masTarde}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Punto({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <View style={s.punto}>
      <Text style={s.puntoTitulo}>{titulo}</Text>
      <Text style={s.puntoDetalle}>{detalle}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  contenido: { padding: tema.espacio.l, paddingTop: tema.espacio.xl * 2, gap: tema.espacio.m },
  titulo: { ...tema.tipo.titulo, color: tema.color.texto },
  entrada: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, lineHeight: 22 },
  seccion: {
    ...tema.tipo.seccion,
    color: tema.color.marca,
    marginTop: tema.espacio.m,
  },
  punto: { gap: tema.espacio.xs },
  puntoTitulo: { ...tema.tipo.cuerpo, color: tema.color.texto, fontWeight: '600' },
  puntoDetalle: { ...tema.tipo.detalle, color: tema.color.textoSuave, lineHeight: 19 },
  cuerpo: { ...tema.tipo.detalle, color: tema.color.textoSuave, lineHeight: 19 },
  nota: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginTop: tema.espacio.s },
  aviso: { ...tema.tipo.detalle, color: tema.color.bajo, lineHeight: 19 },
  boton: {
    backgroundColor: tema.color.marca,
    borderRadius: tema.radio.m,
    paddingVertical: tema.espacio.m,
    alignItems: 'center',
    marginTop: tema.espacio.m,
  },
  botonInactivo: { opacity: 0.4 },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
  saltar: {
    ...tema.tipo.detalle,
    color: tema.color.textoSuave,
    textAlign: 'center',
    paddingVertical: tema.espacio.m,
  },
});
