import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { clasificacion, type LigaRemota, type Puesto } from '../datos/ligas';
import { sincroniza } from '../datos/sincroniza';
import { HAY_SERVIDOR } from '../datos/supabase';
import { etiquetaPersona, inicialPersona, nombreHorizonte, nombreLiga, ordinal } from '../i18n/ligas';
import { idiomaDelSistema } from '../i18n/textos';
import type { IdLiga } from '../motor/ligas';
import { HORIZONTES, HORIZONTE_POR_DEFECTO, type IdHorizonte } from '../motor/ranking';
import { tema } from '../tema';

/**
 * Clasificacion de las ligas.
 *
 * Criterio visual heredado del panel v2, que el usuario aprobo despues de rechazar la v1:
 * cero bordes de color, la jerarquia la hace el tamano tipografico, y el color solo aparece
 * cuando un dato sale de lo habitual. La seleccion se marca con peso y un punto, no con un
 * borde de color saturado.
 */

type Props = {
  ligas: readonly LigaRemota[];
  yo: string | null;
  onCrear: () => void;
  onEntrar: () => void;
};

export function Ligas({ ligas, yo, onCrear, onEntrar }: Props) {
  const idioma = idiomaDelSistema();
  const [ligaActiva, setLigaActiva] = useState<string | null>(ligas[0]?.id ?? null);
  const [horizonte, setHorizonte] = useState<IdHorizonte>(HORIZONTE_POR_DEFECTO);
  const [tabla, setTabla] = useState<readonly Puesto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (ligaActiva === null) return;
    setCargando(true);
    setError(null);
    try {
      // Se sincroniza primero para que la propia puntuacion este al dia antes de leer la tabla.
      await sincroniza();
      setTabla(await clasificacion(ligaActiva, horizonte));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [ligaActiva, horizonte]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!HAY_SERVIDOR) {
    return (
      <View style={[s.fondo, s.centro]}>
        <Text style={s.titulo}>Sin servidor</Text>
        <Text style={s.suave}>
          Falta configurar las claves de Supabase. Mientras tanto la app calcula tu puntuación en
          el teléfono, pero no hay con quién compararla.
        </Text>
      </View>
    );
  }

  if (ligas.length === 0) {
    return (
      <View style={[s.fondo, s.centro]}>
        <Text style={s.titulo}>Todavía no tienes liga</Text>
        <Text style={s.suave}>
          Crea una y pásale el código a quien quieras, o entra con el código que te hayan dado.
        </Text>
        <Pressable style={s.boton} onPress={onCrear}>
          <Text style={s.botonTexto}>Crear una liga</Text>
        </Pressable>
        <Pressable style={s.secundario} onPress={onEntrar}>
          <Text style={s.secundarioTexto}>Tengo un código</Text>
        </Pressable>
      </View>
    );
  }

  const liga = ligas.find((l) => l.id === ligaActiva) ?? ligas[0];
  const miPuesto = tabla.findIndex((p) => p.usuario === yo);

  return (
    <ScrollView
      style={s.fondo}
      contentContainerStyle={s.contenido}
      refreshControl={
        <RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={tema.color.marca} />
      }
    >
      {/* Selector de liga. Menu horizontal con marca de seleccion por peso, no por borde. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tiras}>
        {ligas.map((l) => {
          const activa = l.id === liga.id;
          return (
            <Pressable key={l.id} onPress={() => setLigaActiva(l.id)} style={s.tira}>
              <Text style={[s.tiraTexto, activa && s.tiraActiva]}>
                {l.deporte === null ? nombreLiga('global', idioma) : l.nombre}
              </Text>
              {activa && <View style={s.punto} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Ventana temporal. Las de calendario y las moviles responden preguntas distintas. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tiras}>
        {HORIZONTES.map((h) => {
          const activa = h.id === horizonte;
          return (
            <Pressable key={h.id} onPress={() => setHorizonte(h.id)} style={s.tira}>
              <Text style={[s.tiraTextoSuave, activa && s.tiraActiva]}>
                {nombreHorizonte(h.id, idioma)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {miPuesto >= 0 && (
        <View style={s.hero}>
          <Text style={s.heroCifra}>{tabla[miPuesto].puntos}</Text>
          <Text style={s.heroTexto}>
            {ordinal(miPuesto + 1, idioma)} de {tabla.length} en {liga.nombre}
          </Text>
        </View>
      )}

      {error !== null && <Text style={s.error}>{error}</Text>}

      {cargando && tabla.length === 0 && (
        <ActivityIndicator color={tema.color.marca} style={s.espera} />
      )}

      {!cargando && tabla.length === 0 && (
        <Text style={s.suave}>
          Nadie ha puntuado en esta ventana todavía. Las puntuaciones aparecen cuando cada persona
          abre la app y su teléfono sube la cifra.
        </Text>
      )}

      {tabla.map((p, i) => {
        const esYo = p.usuario === yo;
        const etiqueta = etiquetaPersona(p.nombre, esYo, idioma);
        return (
          <View key={p.usuario} style={s.fila}>
            <Text style={[s.puesto, esYo && s.negrita]}>{i + 1}</Text>
            <View style={s.avatar}>
              <Text style={s.avatarTexto}>{inicialPersona(p.nombre, esYo, idioma)}</Text>
            </View>
            <View style={s.filaMedio}>
              <Text style={[s.nombre, esYo && s.negrita]}>{etiqueta}</Text>
              <Text style={s.filaDetalle}>
                {p.sesiones === 1 ? '1 sesión' : `${p.sesiones} sesiones`}
                {p.tono === 'fuerte' ? ' · semana fuerte' : ''}
              </Text>
            </View>
            <Text style={[s.puntos, esYo && s.negrita]}>{p.puntos}</Text>
          </View>
        );
      })}

      <Text style={s.codigo}>Código de {liga.nombre}: {liga.codigo}</Text>

      <View style={s.acciones}>
        <Pressable style={s.secundario} onPress={onCrear}>
          <Text style={s.secundarioTexto}>Crear otra liga</Text>
        </Pressable>
        <Pressable style={s.secundario} onPress={onEntrar}>
          <Text style={s.secundarioTexto}>Entrar con código</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  contenido: { padding: tema.espacio.l, paddingBottom: tema.espacio.xl * 2 },
  centro: { alignItems: 'center', justifyContent: 'center', padding: tema.espacio.l },
  titulo: { ...tema.tipo.titulo, color: tema.color.texto, marginBottom: tema.espacio.s },
  suave: {
    ...tema.tipo.cuerpo,
    color: tema.color.textoSuave,
    textAlign: 'center',
    marginBottom: tema.espacio.l,
  },
  tiras: { marginBottom: tema.espacio.m },
  tira: { marginRight: tema.espacio.m, alignItems: 'center' },
  tiraTexto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave },
  tiraTextoSuave: { ...tema.tipo.detalle, color: tema.color.textoSuave },
  tiraActiva: { color: tema.color.texto, fontWeight: '600' },
  punto: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: tema.color.marca,
    marginTop: tema.espacio.xs,
  },
  hero: { marginBottom: tema.espacio.l },
  heroCifra: { fontSize: 56, fontWeight: '600', color: tema.color.texto, letterSpacing: -1.5 },
  heroTexto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tema.espacio.s + 2,
  },
  puesto: {
    ...tema.tipo.detalle,
    color: tema.color.textoSuave,
    width: 20,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1d1f27',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tema.espacio.s + 2,
  },
  avatarTexto: { ...tema.tipo.detalle, color: tema.color.marca, fontWeight: '600' },
  filaMedio: { flex: 1 },
  nombre: { ...tema.tipo.cuerpo, color: tema.color.texto },
  filaDetalle: { ...tema.tipo.detalle, color: tema.color.textoSuave },
  puntos: { ...tema.tipo.cuerpo, color: tema.color.texto, fontVariant: ['tabular-nums'] },
  negrita: { fontWeight: '600' },
  codigo: {
    ...tema.tipo.detalle,
    color: tema.color.textoSuave,
    marginTop: tema.espacio.l,
  },
  acciones: { marginTop: tema.espacio.m, gap: tema.espacio.s },
  boton: {
    backgroundColor: tema.color.marca,
    paddingVertical: tema.espacio.m,
    paddingHorizontal: tema.espacio.l,
    borderRadius: tema.radio.m,
    marginBottom: tema.espacio.s,
  },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
  secundario: { paddingVertical: tema.espacio.s + 2 },
  secundarioTexto: { ...tema.tipo.cuerpo, color: tema.color.marca },
  error: { ...tema.tipo.detalle, color: tema.color.bajo, marginBottom: tema.espacio.m },
  espera: { marginVertical: tema.espacio.l },
});
