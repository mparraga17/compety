import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { Buscador } from '../componentes/Buscador';
import { Pulsable } from '../componentes/Pulsable';
import { mensajeDe } from '../datos/errores';
import { canonicaliza, distritosDeCatalogo, fusionaCiudades, fusionaDistritos } from '../datos/distritos';
import { ciudadesVivas, distritosVivos, salirDeZona, unirseAZona, type LigaRemota } from '../datos/ligas';
import { hayUbicacion, sugerirZona } from '../datos/ubicacion';
import { idiomaActual, textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Entrar en las ligas públicas de tu zona: ciudad obligatoria, distrito opcional.
 *
 * ⭐⭐ EL EMBUDO DE LA ZONA (decisión del usuario, 8 sep: "podemos combinar las 3", y por la
 * tarde: "buscar y que se vayan desplegando en función de las letras, y si no se encuentra
 * introducir manualmente"). Las tres fuentes desembocan en UN buscador por campo:
 *
 *   1. GPS         rellena ciudad y distrito si el geocoder los da
 *   2. catálogo    ciudades grandes y sus distritos oficiales (datos/distritos.ts)
 *   3. servidor    ciudades y distritos con liga viva, aunque no sean oficiales
 *   4. teclear     filtra la lista con cada letra; si no aparece, lo escrito vale tal
 *                  cual (fila «Usar…» del propio buscador)
 *
 * El porqué sigue siendo la fragmentación: con texto libre a secas, «Chamberí» y
 * «chamberi» serían dos ligas, y el arranque en frío es el riesgo nº1 de las ligas de
 * zona. El buscador converge por construcción (la fusión absorbe grafías por clave
 * normalizada, y elegir o salir del campo adopta la oficial) sin cerrar la puerta a
 * ningún pueblo o barrio que no esté en las listas.
 *
 * ⚠️ La coordenada nunca sale del teléfono (ver `datos/ubicacion.ts`) y el permiso se pide
 * AL PULSAR el botón, no al abrir la pantalla: la hoja de iOS llega cuando el porqué es
 * evidente, que es la regla de Apple sobre permisos ("ask at the right moment").
 */

type Props = {
  /** Ligas actuales, para saber si ya estás en una zona y precargar los campos. */
  ligas: readonly LigaRemota[];
  onHecho: () => void;
  onCancelar: () => void;
};

export function Zona({ ligas, onHecho, onCancelar }: Props) {
  const idioma = idiomaActual();
  const t = textos(idioma);

  // Zona actual, si la hay: precarga los campos para que "cambiar" no sea reescribir.
  const actual = ligas.find((l) => l.zona !== null)?.zona ?? null;
  const conDistrito = ligas.find((l) => l.zona?.distrito != null)?.zona ?? null;

  const [ciudad, setCiudad] = useState(actual?.ciudad ?? '');
  const [distrito, setDistrito] = useState(conDistrito?.distrito ?? '');
  /** Ciudades con liga viva, para el buscador de ciudad. Se piden una vez. */
  const [ciudades, setCiudades] = useState<readonly string[]>([]);
  /** Distritos con liga viva en la ciudad escrita, leídos del servidor. */
  const [vivos, setVivos] = useState<readonly string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puede = !ocupado && ciudad.trim().length > 0;

  useEffect(() => {
    ciudadesVivas()
      .then(setCiudades)
      .catch(() => setCiudades([]));
  }, []);

  /**
   * Los distritos vivos se piden cuando la ciudad "asienta" (600 ms sin teclear), no en cada
   * pulsación: es una consulta de red y "Madri" a medio escribir no aporta nada. Si falla se
   * queda la lista del catálogo, que ya cubre las ciudades grandes.
   */
  useEffect(() => {
    const nombre = ciudad.trim();
    if (nombre.length === 0) {
      setVivos([]);
      return;
    }
    const temporizador = setTimeout(() => {
      distritosVivos(nombre)
        .then(setVivos)
        .catch(() => setVivos([]));
    }, 600);
    return () => clearTimeout(temporizador);
  }, [ciudad]);

  /** Catálogo + servidor, sin duplicados. Cambia al cambiar la ciudad. */
  const opcionesCiudad = useMemo(() => fusionaCiudades(ciudades), [ciudades]);
  const opcionesDistrito = useMemo(() => fusionaDistritos(ciudad, vivos), [ciudad, vivos]);

  /** Lo que se envía converge a la grafía de las listas, se haya tecleado como se haya tecleado. */
  function confirmar() {
    const c = canonicaliza(ciudad, opcionesCiudad);
    const d = canonicaliza(distrito, opcionesDistrito);
    return accion(() => unirseAZona(c, d));
  }

  async function accion(fn: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      onHecho();
    } catch (e) {
      setError(mensajeDe(e));
      setOcupado(false);
    }
  }

  /**
   * El GPS rellena los campos; no envía nada. Confirmar sigue siendo un toque explícito de
   * la persona, así que la agencia queda intacta y el fallo del geocoder no bloquea: si no
   * encuentra nada, los campos siguen ahí para escribir.
   */
  async function usarUbicacion() {
    setBuscando(true);
    setError(null);
    try {
      const r = await sugerirZona();
      if (r.tipo === 'ok') {
        // El nombre del geocoder adopta la grafía de las listas si coincide por clave:
        // un «chamberi» del GPS entra ya como «Chamberí». Para el distrito vale el
        // catálogo de la ciudad nueva; los vivos llegarán con el debounce y el envío
        // vuelve a canonicalizar de todas formas.
        const c = canonicaliza(r.zona.ciudad, opcionesCiudad);
        setCiudad(c);
        setDistrito(canonicaliza(r.zona.distrito ?? '', distritosDeCatalogo(c)));
      } else if (r.tipo === 'sin-permiso') {
        setError(t.ubicacionDenegada);
      } else {
        setError(t.ubicacionSinResultado);
      }
    } catch {
      setError(t.ubicacionSinResultado);
    } finally {
      setBuscando(false);
    }
  }

  return (
    /*
      Los arreglos de teclado de NuevaLiga, propagados: sin `keyboardShouldPersistTaps` el
      primer toque en el botón solo cierra el teclado, y la vuelta va arriba, donde el pulgar
      la espera y el teclado no la tapa.
    */
    <ScrollView
      style={s.fondo}
      contentContainerStyle={s.contenido}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <Pulsable style={s.volver} accessibilityRole="button" onPress={onCancelar}>
        <Text style={s.volverTexto}>‹ {t.atras}</Text>
      </Pulsable>

      <Text style={s.titulo}>{t.zonaTitulo}</Text>
      <Text style={s.suave}>{t.zonaTexto}</Text>
      <Text style={s.privacidad}>{t.zonaPrivacidad}</Text>

      {/*
        ⭐ El atajo delante de los campos: es el camino feliz. Secundario en forma (no es el
        botón de confirmar) pero primero en orden, como el "현재 위치로 찾기" del picker
        coreano que sirvió de referencia.

        ⚠️ Solo si el contenedor nativo trae ExpoLocation: en el Development Build viejo el
        botón desaparece y quedan los campos, en vez de un botón que revienta al pulsarlo.
      */}
      {hayUbicacion() && (
        <Pulsable
          style={s.botonUbicacion}
          disabled={buscando || ocupado}
          accessibilityRole="button"
          onPress={() => void usarUbicacion()}
        >
          {buscando ? (
            <ActivityIndicator size="small" color={tema.color.marca} />
          ) : (
            <Text style={s.botonUbicacionIcono}>◉</Text>
          )}
          <Text style={s.botonUbicacionTexto}>
            {buscando ? t.ubicacionBuscando : t.usarUbicacion}
          </Text>
        </Pulsable>
      )}

      <Text style={s.seccion}>{t.ciudad}</Text>
      {/*
        ⭐ Los dos campos son el mismo control: buscas, la lista se acorta con cada letra, y
        si lo tuyo no sale lo escribes y ya (fila «Usar…» dentro del propio buscador). Un
        control = un comportamiento, en vez del trío campo + desplegable + «Otro…».
      */}
      <Buscador
        etiqueta={t.ciudad}
        valor={ciudad}
        onCambio={setCiudad}
        opciones={opcionesCiudad}
        placeholder={t.ciudadEjemplo}
      />

      <Text style={[s.seccion, s.seccionSeparada]}>{t.distrito}</Text>
      <Buscador
        etiqueta={t.distrito}
        valor={distrito}
        onCambio={setDistrito}
        opciones={opcionesDistrito}
        placeholder={t.distritoEjemplo}
        returnKeyType="go"
        onSubmitEditing={() => {
          if (puede) void confirmar();
        }}
      />
      <Text style={[s.nota, s.notaSeparada]}>{t.distritoOpcional}</Text>

      <Pulsable
        style={[s.boton, !puede && s.botonApagado]}
        disabled={!puede}
        accessibilityRole="button"
        onPress={() => void confirmar()}
      >
        <Text style={s.botonTexto}>{actual === null ? t.unirmeAZona : t.cambiarZona}</Text>
      </Pulsable>

      {/*
        Salirse solo aparece si YA estás en una zona. Con el aviso al lado, no en una alerta:
        no es destructivo de verdad (las privadas no se tocan), así que una confirmación
        modal sería entrenar a la gente a pasar de las confirmaciones.
      */}
      {actual !== null && (
        <>
          <Pulsable
            style={s.secundario}
            disabled={ocupado}
            accessibilityRole="button"
            onPress={() => void accion(salirDeZona)}
          >
            <Text style={s.salirTexto}>{t.salirDeZona}</Text>
          </Pulsable>
          <Text style={s.nota}>{t.salirDeZonaAviso}</Text>
        </>
      )}

      <Pulsable style={s.secundario} accessibilityRole="button" onPress={onCancelar}>
        <Text style={s.secundarioTexto}>{t.cancelar}</Text>
      </Pulsable>

      {ocupado && <ActivityIndicator color={tema.color.marca} style={s.espera} />}
      {error !== null && <Text style={s.error}>{error}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: tema.color.fondo,
    padding: tema.espacio.l,
    // Dentro de una hoja `pageSheet`: sin `seguroArriba`, la hoja ya cuelga de la isla.
    paddingTop: tema.espacio.m,
  },
  contenido: { paddingBottom: tema.espacio.xl },
  volver: { minHeight: tema.tactil, justifyContent: 'center', marginBottom: tema.espacio.s },
  volverTexto: { ...tema.tipo.cuerpo, color: tema.color.marca },
  titulo: { ...tema.tipo.tituloPantalla, color: tema.color.texto, marginBottom: tema.espacio.s },
  suave: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginBottom: tema.espacio.s },
  // La promesa de privacidad, discreta pero presente antes de los campos.
  privacidad: { ...tema.tipo.detalle, color: tema.color.textoTenue, marginBottom: tema.espacio.l },
  // Atajo de GPS: fondo sutil de marca, como el botón de amigos de la cabecera de Competi.
  botonUbicacion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: tema.tactil,
    borderRadius: tema.radio.m,
    backgroundColor: 'rgba(198,203,240,0.14)',
    marginBottom: tema.espacio.l,
  },
  botonUbicacionIcono: { fontSize: 13, color: tema.color.marca },
  botonUbicacionTexto: { ...tema.tipo.cuerpo, color: tema.color.marca, fontWeight: '600' },
  seccion: {
    ...tema.tipo.seccion,
    color: tema.color.textoSuave,
    marginBottom: tema.espacio.s,
  },
  // El buscador no trae margen inferior (su lista cuelga pegada), lo ponen los vecinos.
  seccionSeparada: { marginTop: tema.espacio.m },
  nota: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginBottom: tema.espacio.m },
  notaSeparada: { marginTop: tema.espacio.s },
  boton: {
    backgroundColor: tema.color.marca,
    minHeight: tema.tactil,
    justifyContent: 'center',
    borderRadius: tema.radio.m,
    alignItems: 'center',
    marginTop: tema.espacio.m,
    marginBottom: tema.espacio.s,
  },
  botonApagado: { opacity: 0.4 },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
  secundario: { minHeight: tema.tactil, justifyContent: 'center', alignItems: 'center' },
  secundarioTexto: { ...tema.tipo.cuerpo, color: tema.color.marca },
  // Salir va en el coral de "peor", pero como texto: no es un botón que invite.
  salirTexto: { ...tema.tipo.cuerpo, color: tema.color.bajo },
  espera: { marginTop: tema.espacio.m },
  error: { ...tema.tipo.detalle, color: tema.color.bajo, marginTop: tema.espacio.m },
});
