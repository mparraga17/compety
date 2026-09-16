import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { registrarSegundoPlano } from './src/avisos/segundoPlano';
import { escucharToques, guardarToken, prepararCanal, prepararPush } from './src/avisos/push';
import { Celebracion } from './src/componentes/Celebracion';
import { HALO_PODIO } from './src/componentes/Halo';
import { Marca } from './src/componentes/Marca';
import { Pestanas, type IdPestana } from './src/componentes/Pestanas';
import { Pulsable } from './src/componentes/Pulsable';
import { Simbolo } from './src/componentes/Simbolo';
import { hapticaExito } from './src/componentes/haptica';
import { guardaDeporte, guardaEsfuerzo, marcaCelebrado, yaCelebrado } from './src/datos/almacen';
import { almacenNativo } from './src/datos/almacenNativo';
import { alCerrarseSesion, sesionActual, type Cuenta, type EstadoSesion } from './src/datos/cuenta';
import { codigoDeUrl } from './src/datos/enlaces';
import { misLigas, type LigaRemota, type Movimiento } from './src/datos/ligas';
import { calcula } from './src/datos/sincroniza';
import { HAY_SERVIDOR } from './src/datos/supabase';
import { declararZonaHoraria } from './src/datos/zonaHoraria';
import { nombreLiga, ordinal } from './src/i18n/ligas';
import { conValores, idiomaActual, textos } from './src/i18n/textos';
import type { Resultado } from './src/motor/sesiones';
import { HORIZONTES, enVentana } from './src/motor/ranking';
import { claveSemana } from './src/motor/semana';
import { Amigos } from './src/pantallas/Amigos';
import { Bienvenida } from './src/pantallas/Bienvenida';
import { Diagnostico } from './src/pantallas/Diagnostico';
import { Entrar } from './src/pantallas/Entrar';
import { Hoy } from './src/pantallas/Hoy';
import { Ligas } from './src/pantallas/Ligas';
import { NuevaLiga } from './src/pantallas/NuevaLiga';
import { Perfil } from './src/pantallas/Perfil';
import { Persona } from './src/pantallas/Persona';
import type { PersonaRef } from './src/pantallas/Feed';
import { Sesiones } from './src/pantallas/Sesiones';
import { Zona } from './src/pantallas/Zona';
import { Salud } from './src/pantallas/Salud';
import { Sueno } from './src/pantallas/Sueno';
import { procesaSueno, type Sueno as DatosSueno } from './src/motor/sueno';
import { procesaSalud, type Metrica } from './src/motor/salud';
import { OBJETIVO_MINUTOS, calculaOms, type Oms, type SesionParaOms } from './src/motor/oms';
import { calculaForma, type Forma } from './src/motor/forma';
import { leerMetricasSalud, leerSueno } from './src/salud/lectura';
import { estadoPermisos } from './src/salud/permisos';
import { tema } from './src/tema';

/**
 * Flujo de arranque y navegacion.
 *
 * 1. Permisos de salud. Antes de la hoja del sistema va la bienvenida, que explica que se lee y
 *    para que. Requisito de Apple: rechazan apps que usan HealthKit sin identificar la funcion
 *    en la interfaz.
 * 2. Cuenta, solo si hay servidor. Sin cuenta la app calcula tu puntuacion pero no hay con quien
 *    compararla.
 * 3. Las cinco pestañas.
 *
 * ⭐ La navegacion se separa en DOS conceptos, y esa es la correccion estructural del 31 ago:
 *
 *   `pestana`  las cinco vistas de la barra inferior. Es donde vive la app.
 *   `modal`    pantallas que TAPAN la barra: amigos, perfil, crear liga, entrar con codigo.
 *
 * Antes habia una sola variable `fase` con todo mezclado, y el resultado era una app de UNA
 * pantalla suelta donde la maqueta tiene cinco. El usuario lo dijo directo y tenia razon.
 *
 * ⚠️ Amigos y perfil son modales a proposito, no pestañas. Se entra desde la cabecera de
 * competicion y son tareas que se terminan y se cierran, no sitios donde te quedas. Meterlas en
 * la barra habria dejado siete pestañas, que es mas de lo que Apple recomienda mostrar.
 *
 * Los avisos push y el segundo plano se preparan una vez dentro, no en el arranque, para no
 * apilar tres hojas de permiso del sistema seguidas.
 */

/**
 * `sin-conexion`: hay sesion guardada pero el servidor no respondio y no hay copia local de la
 * cuenta. Solo pasa la primera vez que se arranca sin red tras instalar (o tras esta version):
 * en cuanto el perfil se lee una vez con red, la copia local permite arrancar sin ella.
 */
type Fase = 'comprobando' | 'bienvenida' | 'entrar' | 'sin-conexion' | 'dentro';
type IdModal = 'amigos' | 'perfil' | 'crear-liga' | 'entrar-liga' | 'zona' | 'diagnostico';

/** Lo que se celebra en pantalla. null = nada abierto. */
type Fiesta = {
  momento: string;
  icono: string;
  cifra: string;
  titulo: string;
  frase: string;
  /** Color del brillo de la celebración, en `r,g,b`. Oro en las victorias; sin él, la marca. */
  rgb?: string;
  /** Suelta confeti. RESERVADO a los dos momentos más altos: ascenso de división y liderato. */
  confetti?: boolean;
} | null;

/**
 * Raíz: el proveedor del área segura envuelve a toda la app.
 *
 * ⭐ Rediseño del 15 sep. Hasta ahora el hueco de la isla dinámica era una constante (56) y el
 * del indicador de inicio otra (24), y las dos estaban mal en más de un iPhone. Con el proveedor,
 * cada pantalla lee los insets reales (`useSafeAreaInsets`) y la barra flotante se apoya donde
 * toca en cada dispositivo.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <Raiz />
    </SafeAreaProvider>
  );
}

function Raiz() {
  /**
   * ⚠️ `idioma` en estado aunque el valor real viva en `i18n/textos.ts`. Es lo que fuerza el
   * repintado: cambiar la variable del modulo no dispara ningun render por si solo.
   */
  const [, setIdioma] = useState(idiomaActual());
  const t = textos();
  const [fase, setFase] = useState<Fase>('comprobando');
  // Arranca en Competi, que es la primera de la barra y la tesis del producto.
  const [pestana, setPestana] = useState<IdPestana>('competi');
  /**
   * ⭐ PILA de modales, no un valor suelto. Arregla un fallo de espacialidad real: desde Perfil
   * se puede abrir Amigos, y con un valor suelto el "volver" de Amigos te soltaba en Competi en
   * vez de en Perfil, de donde viniste. Apple: *"if something disappears one way, we expect it
   * to emerge from where it came"*. Con la pila, cerrar te devuelve exactamente por donde
   * entraste.
   */
  const [modales, setModales] = useState<readonly IdModal[]>([]);
  const modal = modales[modales.length - 1] ?? null;
  /** Celebración en pantalla. Se dispara al detectar un momento pico no celebrado aún. */
  const [fiesta, setFiesta] = useState<Fiesta>(null);
  /**
   * ⭐ Código de liga llegado por ENLACE de invitación (compety://liga/X o la página web).
   *
   * Se guarda en estado y no se actúa al momento porque el enlace puede llegar ANTES de estar
   * dentro: en frío la app pasa por comprobando y entrar, y el código tiene que sobrevivir a
   * ese viaje. El efecto de más abajo lo gasta cuando la fase llega a 'dentro'.
   */
  const [codigoEnlace, setCodigoEnlace] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  /**
   * Avatar de la cabecera de las pestañas de datos (rediseño del 15 sep): antes solo Competi
   * tenía camino al perfil; ahora las cinco lo tienen, y es el mismo avatar con tono de identidad.
   */
  const perfilCabecera = useMemo(
    () =>
      cuenta === null
        ? null
        : {
            nombre: cuenta.nombre ?? cuenta.usuario ?? '?',
            inicial: (cuenta.nombre ?? cuenta.usuario ?? '?').slice(0, 1).toUpperCase(),
          },
    [cuenta],
  );
  const [ligas, setLigas] = useState<readonly LigaRemota[]>([]);
  /**
   * ⭐ La liga que enseña Competi. Vive aquí porque aquí se sabe cuál acabas de crear o a cuál
   * acabas de entrar, y porque las pestañas se montan una sola vez: un `useState` dentro de
   * Ligas se congelaba con la lista del primer render (bug de TestFlight, 11 sep).
   */
  const [ligaActiva, setLigaActiva] = useState<string | null>(null);
  // Candado: nunca apunta a una liga que no esté en la lista. Sin liga elegida, la primera.
  useEffect(() => {
    if (ligas.length === 0) {
      if (ligaActiva !== null) setLigaActiva(null);
      return;
    }
    if (ligaActiva === null || !ligas.some((l) => l.id === ligaActiva)) {
      setLigaActiva(ligas[0].id);
    }
  }, [ligas, ligaActiva]);
  /** Espejo de `ligas` para callbacks estables. Ver el comentario de `celebrarLiderato`. */
  const ligasRef = useRef<readonly LigaRemota[]>([]);
  useEffect(() => {
    ligasRef.current = ligas;
  }, [ligas]);
  // ⭐ El resultado del motor se calcula UNA vez y lo comparten Hoy y Sesiones. Recalcularlo por
  // pestaña obligaria a releer HealthKit en cada toque, que tarda segundos.
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [calculando, setCalculando] = useState(false);
  /**
   * El sueño va aparte y se carga PEREZOSAMENTE, al abrir su pestaña.
   *
   * Motivo: son decenas de muestras de categoría por noche y no hacen falta para competir, que
   * es lo que se ve al arrancar. Cargarlo con el resto alargaría el primer pintado sin que nadie
   * lo esté mirando.
   */
  const [sueno, setSueno] = useState<DatosSueno | null>(null);
  const [cargandoSueno, setCargandoSueno] = useState(false);
  /**
   * Las seis métricas diarias, también perezosas y por el mismo motivo: son seis consultas a
   * HealthKit que no hacen falta para competir.
   *
   * ⚠️ El OMS y la forma NO se leen aparte: salen de `resultado`, que ya está calculado. Leerlos
   * otra vez sería releer HealthKit para datos que ya tenemos.
   */
  const [metricas, setMetricas] = useState<readonly Metrica[] | null>(null);
  const [cargandoMetricas, setCargandoMetricas] = useState(false);

  const abrirModal = useCallback((id: IdModal) => {
    setModales((pila) => [...pila, id]);
  }, []);
  const cerrarModal = useCallback(() => {
    setModales((pila) => pila.slice(0, -1));
  }, []);

  /**
   * ⭐⭐ Enlaces de invitación. Dos fuentes y las dos hacen falta:
   *
   *   `getInitialURL`   la app estaba CERRADA y el enlace la abre. Es el camino del invitado
   *                     nuevo, que viene de la página web o de WhatsApp.
   *   el listener       la app ya estaba abierta (primer o segundo plano) y el enlace llega
   *                     encima.
   *
   * `codigoDeUrl` es estricto: las URLs del dev client y cualquier otra cosa que abra la app
   * devuelven null y no ensucian el estado.
   */
  useEffect(() => {
    let vivo = true;
    void Linking.getInitialURL().then((url) => {
      if (!vivo || url === null) return;
      const codigo = codigoDeUrl(url);
      if (codigo !== null) setCodigoEnlace(codigo);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      const codigo = codigoDeUrl(url);
      if (codigo !== null) setCodigoEnlace(codigo);
    });
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);

  /**
   * Cuando hay código pendiente y ya estamos dentro, se abre "Entrar en liga" con el código
   * puesto. La persona confirma con un toque: entrar en una liga ajena sin enseñar antes qué
   * código se está usando sería quitarle el control de la acción.
   *
   * ⚠️ La pila de modales se SUSTITUYE en vez de apilarse: quien toca una invitación acaba de
   * cambiar de app con esa intención, así que la invitación ES la tarea. Y al cerrar, el
   * `Volver` te deja en Competi, que es donde se ve la liga recién estrenada.
   */
  useEffect(() => {
    if (fase !== 'dentro' || codigoEnlace === null) return;
    setPestana('competi');
    setModales(['entrar-liga']);
  }, [fase, codigoEnlace]);

  /**
   * ⭐ Ascensos y descensos de las ligas de zona, al cerrarse la jornada del lunes.
   *
   * El ASCENSO se celebra a lo grande: es exactamente el momento pico para el que existe
   * `Celebracion` (junto a ganar la semana y cumplir la OMS), y pasa como mucho una vez por
   * semana, que es la frecuencia en la que Emil permite el deleite.
   *
   * El DESCENSO no se celebra ni se esconde: se cuenta con la vía de vuelta delante
   * (`noticiaDescenso`), porque la teoría de la autodeterminación dice que perder la
   * competencia percibida predice abandono, y un descenso sin salida a la vista es eso.
   *
   * ⚠️ `yaCelebrado` con la semana en la clave: el servidor devuelve el movimiento en cada
   * sincronización de esa jornada, y sin el candado local la misma subida se celebraría en
   * cada arranque hasta el lunes siguiente.
   */
  const celebrarMovimientos = useCallback((movimientos: readonly Movimiento[]) => {
    // El mejor primero: si subes en el distrito y en la ciudad a la vez, se celebra una.
    const ascenso = [...movimientos].sort((a, b) => a.a - b.a).find((m) => m.a < m.de);
    const descenso = movimientos.find((m) => m.a > m.de);
    const m = ascenso ?? descenso;
    if (m === undefined) return;

    const momento = `division:${m.ciudad}|${m.distrito ?? ''}|${m.semana}`;
    void (async () => {
      const visto = await yaCelebrado(almacenNativo(), momento).catch(() => true);
      if (visto) return;
      const t = textos();
      const zona = m.distrito ?? m.ciudad;
      if (m === ascenso) {
        setFiesta({
          momento,
          icono: '🏆',
          cifra: conValores(t.divisionCorta, { n: m.a }),
          titulo: conValores(t.celebraAscensoTitulo, { zona }),
          frase: conValores(t.celebraAscensoFrase, { n: m.a }),
          // Ascender es de los dos momentos más altos de la app: brillo de oro y confeti.
          rgb: HALO_PODIO.oro.rgb,
          confetti: true,
        });
      } else {
        // Sin trofeo ni cifra de fiesta: mismo canal para que no se pierda, otro tono.
        setFiesta({
          momento,
          icono: '📉',
          cifra: conValores(t.divisionCorta, { n: m.a }),
          titulo: conValores(t.division, { n: m.a }),
          frase: conValores(t.noticiaDescenso, { n: m.a, zona }),
        });
      }
    })();
  }, []);

  /**
   * ⭐⭐ Celebración de LIDERATO: "Vas primero en X". Era el tercer disparador previsto en la
   * doc de `Celebracion` y el texto (`celebraPrimeroTitulo`) llevaba escrito desde el
   * principio sin cablear: el mismo patrón de pieza terminada y huérfana que la OMS.
   *
   * ⚠️ Una vez por SEMANA y por LIGA, con el lunes en la clave: pasar por Competi no puede
   * relanzar la fiesta cada vez, y ganar en dos ligas son dos momentos distintos.
   *
   * ⚠️ `setFiesta` conserva la fiesta ya abierta si la hay (el ascenso gana la carrera). Y al
   * no marcarse el momento hasta que se cierra la celebración, el liderato no se pierde: se
   * celebra en la siguiente visita.
   *
   * ⚠️ El nombre de la liga se resuelve con un ref y no metiendo `ligas` en las dependencias:
   * con `ligas` dentro, cada recarga de ligas recrearía el callback, y con él el `cargar` de
   * la pantalla, que volvería a sincronizar sin que nadie lo pidiera.
   */
  const celebrarLiderato = useCallback((ligaId: string, puntos: number) => {
    // Una vez por semana y liga: la semana es la del motor (`semana.ts`), la misma que cierra.
    const momento = `primero:${ligaId}:${claveSemana(Date.now())}`;

    void (async () => {
      const visto = await yaCelebrado(almacenNativo(), momento).catch(() => true);
      if (visto) return;
      const t = textos();
      const idioma = idiomaActual();
      const liga = ligasRef.current.find((l) => l.id === ligaId);
      const nombre =
        liga === undefined
          ? ''
          : liga.zona !== null
            ? (liga.zona.distrito ?? liga.zona.ciudad)
            : liga.deporte === null
              ? nombreLiga('global', idioma)
              : liga.nombre;
      if (nombre === '') return;

      setFiesta((previa) =>
        previa !== null
          ? previa
          : {
              momento,
              icono: '👑',
              cifra: ordinal(1, idioma),
              titulo: conValores(t.celebraPrimeroTitulo, { liga: nombre }),
              frase: conValores(t.celebraPrimeroFrase, { p: puntos }),
              rgb: HALO_PODIO.oro.rgb,
              confetti: true,
            },
      );
    })();
  }, []);

  const cargarLigas = useCallback(async () => {
    try {
      setLigas(await misLigas());
    } catch {
      /*
       * ⛔⛔ AQUÍ HABÍA UN `setLigas([])`, y convertía cualquier fallo del servidor en "no tienes
       * ligas", que es MENTIRA. Visto en el iPhone: Supabase en el plan gratuito se pausa por
       * inactividad, la consulta falló, y la app enseñó la pantalla de "crea tu primera liga" a
       * alguien que tiene una liga con sus datos dentro. Eso invita a crear un duplicado.
       *
       * Un fallo de red no es un estado de la cuenta. Se conserva lo último que se supo (aunque
       * sea de la sesión anterior en memoria) y no se afirma nada que no se haya podido leer.
       */
    }
  }, []);

  const cargarSalud = useCallback(async () => {
    setCalculando(true);
    try {
      // El año entero con base movil de 90 dias: lo mismo que sube la sincronizacion, para que
      // los puntos que ves sean los que compiten. Ver `inicioDeLectura` en sincroniza.ts.
      setResultado(await calcula());
    } catch {
      // Sin permisos o sin datos: las pantallas ya saben pintar el caso vacio.
      setResultado(null);
    } finally {
      setCalculando(false);
    }
  }, []);

  /**
   * Guarda el esfuerzo declarado y recalcula.
   *
   * El s-RPE lo genera la app y NO existe en HealthKit, así que hay que persistirlo o el
   * deslizador no sirve de nada. Al recalcular, esa sesión pasa de `estimada` a `declarada`,
   * con descuento 0,97 en vez de 0,95, y la base personal se ajusta con ella.
   */
  const declararEsfuerzo = useCallback(
    async (idSesion: string, rpe: number) => {
      try {
        await guardaEsfuerzo(almacenNativo(), idSesion, rpe);
      } catch {
        // Si el almacén falla no se pierde nada más que el ajuste: la sesión sigue puntuando
        // estimada. No se avisa con una alerta por algo que no bloquea.
        return;
      }
      await cargarSalud();
    },
    [cargarSalud],
  );

  /**
   * Corrige el deporte de una sesión y recalcula.
   *
   * Existe porque Fitbit escribe algunas sesiones en Apple Health como "otro" (código 3000)
   * aunque en su app tengan deporte: medido con las pesas del usuario. La corrección vive en
   * el teléfono y se reaplica en cada lectura, así que sobrevive a HealthKit. Al recalcular,
   * la sesión puntúa con el peso MET del deporte real y entra en su liga.
   */
  const corregirDeporte = useCallback(
    async (idSesion: string, tipo: string) => {
      try {
        await guardaDeporte(almacenNativo(), idSesion, tipo);
      } catch {
        // Mismo criterio que el esfuerzo: si el almacén falla, la sesión sigue como estaba.
        return;
      }
      await cargarSalud();
    },
    [cargarSalud],
  );

  const cargarSueno = useCallback(async () => {
    setCargandoSueno(true);
    try {
      setSueno(procesaSueno(await leerSueno(30)));
    } catch {
      // Sin permiso de sueño o sin datos. La pantalla sabe pintar el caso vacío, y no se puede
      // distinguir un caso del otro: iOS no dice si negaste permiso de lectura.
      setSueno(null);
    } finally {
      setCargandoSueno(false);
    }
  }, []);

  /**
   * Entrar con una cuenta ya completa. Un solo camino para el arranque con sesion guardada y
   * para el alta: antes eran dos copias, y las copias son donde un arreglo se olvida.
   *
   * ⭐ La zona horaria se declara ANTES de cargar nada del servidor: la primera sincronizacion
   * (que dispara Competi al montarse) cierra tus periodos con la zona que el servidor conozca, y
   * tiene que ser la de hoy, no la del ultimo viaje. Solo escribe si cambio; si falla (sin red),
   * el servidor sigue con la ultima conocida y se reintenta en el siguiente arranque.
   */
  const entrarDentro = useCallback(
    async (c: Cuenta) => {
      setCuenta(c);
      await declararZonaHoraria().catch(() => null);
      await cargarLigas();
      setFase('dentro');
      void cargarSalud();
    },
    [cargarLigas, cargarSalud],
  );

  /**
   * Arranque: permisos de salud y sesion. Es una funcion y no solo un efecto porque la pantalla
   * de "sin conexion" la vuelve a llamar al reintentar.
   *
   * ⛔⛔ Aqui vivia el fallo que expulsaba al alta a gente con cuenta. `sesionActual()` devolvia
   * `null` tanto si no habia sesion como si la habia y el servidor no respondio, y las dos cosas
   * acababan en `setFase('entrar')`: la persona veia "Entrar con Apple", creia haber perdido su
   * cuenta y podia acabar creando ligas duplicadas. Ahora los tres casos van por separado.
   */
  const arrancar = useCallback(async () => {
    setFase('comprobando');
    let permisos = false;
    try {
      permisos = (await estadoPermisos()).tipo === 'preguntado';
    } catch {
      permisos = false;
    }
    if (!permisos) {
      setFase('bienvenida');
      return;
    }

    if (!HAY_SERVIDOR) {
      setFase('dentro');
      void cargarSalud();
      return;
    }

    const estado = await sesionActual().catch(
      (error: unknown): EstadoSesion => ({ tipo: 'sin-comprobar', error }),
    );
    if (estado.tipo === 'sin-sesion') {
      setFase('entrar');
      return;
    }
    if (estado.tipo === 'sin-comprobar') {
      // Hay sesion guardada y no se pudo comprobar. No se afirma nada: ni "entra" ni "dentro".
      setFase('sin-conexion');
      return;
    }

    // Se vuelve a `entrar` si falta cualquiera de los dos nombres: el visible o el de usuario.
    // La propia pantalla salta los pasos que ya esten hechos.
    const c = estado.cuenta;
    if (c.nombre === null || c.usuario === null) {
      setFase('entrar');
      return;
    }
    await entrarDentro(c);
  }, [entrarDentro]);

  useEffect(() => {
    void arrancar();
  }, [arrancar]);

  /**
   * Vuelta al principio: cerrar sesion, borrar la cuenta, o que la sesion muera sola.
   *
   * Es una sola funcion para que los tres caminos dejen la app en el MISMO estado. Antes solo
   * existia inline en `onFuera` del perfil, y la sesion que moria sola (token revocado, cuenta
   * borrada desde otro dispositivo) no pasaba por ahi: la app seguia "dentro" sin poder subir
   * nada y sin decirlo.
   */
  const fueraDeLaCuenta = useCallback(() => {
    setCuenta(null);
    setLigas([]);
    setResultado(null);
    setModales([]);
    setFase('entrar');
  }, []);

  // ⚠️ Solo reacciona estando dentro. supabase-js tambien emite SIGNED_OUT al descubrir una
  // sesion muerta durante el propio arranque, y ahi `arrancar` ya ha decidido a donde ir.
  const faseRef = useRef<Fase>('comprobando');
  useEffect(() => {
    faseRef.current = fase;
  }, [fase]);
  useEffect(() => {
    return alCerrarseSesion(() => {
      if (faseRef.current === 'dentro') fueraDeLaCuenta();
    });
  }, [fueraDeLaCuenta]);

  const cargarMetricas = useCallback(async () => {
    setCargandoMetricas(true);
    try {
      setMetricas(procesaSalud(await leerMetricasSalud(90)));
    } catch {
      setMetricas(null);
    } finally {
      setCargandoMetricas(false);
    }
  }, []);

  /**
   * ⛔⛔ Refresco COMPLETO de la pestaña Salud. Arregla un fallo real, no es una mejora estética.
   *
   * El gesto de tirar hacia abajo llamaba solo a `cargarMetricas`, así que refrescaba las seis
   * métricas del cuerpo y dejaba el objetivo de la OMS y el eje de forma con los datos de antes.
   * Y esos dos son lo primero de la pantalla, o sea que el usuario tiraba para actualizar, veía la
   * rueda girar, y la cifra grande de arriba no se movía.
   *
   * La causa es que OMS y forma NO se leen aparte: se derivan de `resultado`, que lo produce
   * `cargarSalud`. Así que un refresco de verdad tiene que llamar a las dos cosas.
   *
   * ⚠️ En paralelo con `Promise.all` y no en serie: son dos consultas independientes a HealthKit y
   * encadenarlas dobla la espera con la rueda girando. Apple es explícito con esto, *"be vigilant
   * about every latency"*: una espera evitable en la ruta de una interacción es una regresión.
   */
  const refrescarSalud = useCallback(async () => {
    await Promise.all([cargarMetricas(), cargarSalud()]);
  }, [cargarMetricas, cargarSalud]);

  // El sueño se lee la primera vez que se abre su pestaña, no en el arranque. Después se queda
  // en memoria: recargarlo lo pide el usuario tirando de la lista.
  useEffect(() => {
    if (fase !== 'dentro' || pestana !== 'sueno' || sueno !== null || cargandoSueno) return;
    void cargarSueno();
  }, [fase, pestana, sueno, cargandoSueno, cargarSueno]);

  useEffect(() => {
    if (fase !== 'dentro' || pestana !== 'salud' || metricas !== null || cargandoMetricas) return;
    void cargarMetricas();
  }, [fase, pestana, metricas, cargandoMetricas, cargarMetricas]);

  /**
   * OMS y forma salen del resultado que ya está calculado, no de una lectura nueva.
   *
   * ⚠️ La ventana de la OMS es de 7 días, porque el objetivo está definido por semana. `resultado`
   * trae 30, así que aquí se recorta. La forma sí usa todo el historial: compara la primera mitad
   * con la segunda y necesita el máximo de sesiones posible.
   */
  const omsActual = useMemo<Oms | null>(() => {
    if (resultado === null) return null;
    const semana = HORIZONTES.find((h) => h.id === 'd7')!;
    // `enVentana` trabaja con `SesionPuntuada`, que no lleva zonas, así que se filtra sobre la
    // lista completa con el mismo corte temporal.
    const ids = new Set(enVentana(resultado.sesiones, semana).map((s) => s.id));
    return calculaOms(resultado.sesiones.filter((s) => ids.has(s.id)));
  }, [resultado]);

  /**
   * ⭐⭐ CELEBRACIÓN del objetivo de la OMS, el primer momento pico cableado.
   *
   * `Celebracion.tsx` estaba escrita y NADIE la usaba, el mismo patrón que ya pasó con
   * `CargaEstimada` y con `Diagnostico`: piezas terminadas y huérfanas. Su propia doc lista los
   * disparadores (cumplir la OMS, ganar la semana, batir tu media) y este es el que no depende
   * del servidor, así que funciona incluso sin cuenta.
   *
   * ⚠️ Cada logro se celebra UNA VEZ, persistido con el lunes de la semana en la clave. Una
   * celebración que reaparece en cada arranque deja de significar nada: es la regla de utilidad
   * de Apple sobre feedback, *"over-feedback trains users to ignore all of it"*.
   *
   * ⚠️ Y no se dispara encima de un modal ni antes de estar dentro: taparía una tarea a medias.
   */
  useEffect(() => {
    if (fase !== 'dentro' || modal !== null || fiesta !== null) return;
    if (omsActual === null || !omsActual.cumple) return;

    // La semana en curso, fecha local. Es el periodo del logro, y la clave conserva el formato
    // que ya hay persistido en los teléfonos de la beta (`oms:2026-9-14`).
    const momento = `oms:${claveSemana(Date.now())}`;

    let vivo = true;
    void (async () => {
      const visto = await yaCelebrado(almacenNativo(), momento).catch(() => true);
      if (!vivo || visto) return;
      const t = textos();
      setFiesta({
        momento,
        icono: '🎯',
        cifra: `${omsActual.equivalente}`,
        titulo: t.celebraOmsTitulo,
        frase: conValores(t.celebraOmsFrase, { n: OBJETIVO_MINUTOS }),
      });
    })();
    return () => {
      vivo = false;
    };
  }, [fase, modal, fiesta, omsActual]);

  const formaActual = useMemo<Forma | null>(() => {
    if (resultado === null) return null;
    // La forma compara la primera mitad del historial con la segunda, así que el historial que
    // se le da define la pregunta. El motor trae el año entero (para la clasificación anual),
    // pero "¿estoy más en forma?" se responde con los últimos meses: la misma ventana que la
    // base personal. Un año entero mediría otra cosa, la tendencia de la temporada.
    const recientes =
      resultado.baseDesde === null
        ? resultado.sesiones
        : resultado.sesiones.filter((s) => s.inicio >= resultado.baseDesde!);
    // La liga con más sesiones comparables es la que da mejor señal.
    const conRitmo = recientes.filter((s) => s.ritmo !== null && s.fcMedia !== null);
    const cuenta = new Map<string, number>();
    for (const s of conRitmo) {
      if (s.liga === null) continue;
      cuenta.set(s.liga, (cuenta.get(s.liga) ?? 0) + 1);
    }
    const mejor = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
    return calculaForma(recientes, {
      liga: (mejor?.[0] ?? 'correr') as 'correr',
    });
  }, [resultado]);

  // Push y segundo plano, una vez ya hay cuenta. Se piden aqui y no antes para no encadenar
  // hojas de permiso del sistema en el primer arranque.
  useEffect(() => {
    if (fase !== 'dentro' || cuenta === null) return;
    (async () => {
      await prepararCanal();
      const estado = await prepararPush();
      if (estado.tipo === 'listo') {
        await guardarToken(estado.token).catch(() => undefined);
      }
      await registrarSegundoPlano();
    })();
  }, [fase, cuenta]);

  /**
   * ⭐ Tocar un aviso lleva a lo que anuncia: la liga, la bandeja de amigos o el feed. Antes el
   * toque solo abría la app y te dejaba donde estuvieras, que es decirle a alguien "Sergio ha
   * comentado tu entreno" y no enseñárselo.
   */
  const [irAlFeed, setIrAlFeed] = useState(0);
  /** La persona cuya ficha (sus entrenos) está abierta. null = ninguna. */
  const [persona, setPersona] = useState<PersonaRef | null>(null);
  useEffect(() => {
    if (fase !== 'dentro') return;
    return escucharToques((destino) => {
      setPestana('competi');
      if (destino.tipo === 'liga') {
        setLigaActiva(destino.liga);
        setModales([]);
      } else if (destino.tipo === 'amigos') {
        setModales(['amigos']);
      } else {
        setModales([]);
        setIrAlFeed((n) => n + 1);
      }
    });
  }, [fase]);



  /**
   * Cabecera de vuelta de los modales. Va arriba y fuera del scroll.
   *
   * ⚠️ Dice a DÓNDE vuelves, y con la pila eso ya es verdad: desde Amigos abierto en Perfil
   * vuelves a Perfil, no a Competi.
   */
  function Volver({ donde, onPress }: { donde: string; onPress: () => void }) {
    return (
      <Pulsable
        style={s.volver}
        accessibilityRole="button"
        accessibilityLabel={donde}
        onPress={onPress}
      >
        {/* El chevron de "atrás" del sistema delante de la palabra: el patrón de iOS. */}
        <Simbolo nombre="chevron.left" tamano={14} color={tema.color.marca} peso="semibold" respaldo="‹" />
        <Text style={s.volverTexto}>{conValores(t.volverA, { donde })}</Text>
      </Pulsable>
    );
  }

  /** Nombre visible de lo que hay debajo del modal de arriba, para el botón de volver. */
  const debajo = modales.length > 1 ? modales[modales.length - 2] : null;
  const nombreVuelta = debajo === 'perfil' ? t.tuPerfil : t.competi;

  return (
    <View style={s.fondo}>
      <StatusBar style="light" />

      {fase === 'comprobando' && (
        /*
          ⭐ La marca en vez de un spinner. Un spinner dice "espera"; la marca dice "llegas".
          La fase dura décimas de segundo, así que el fundido de entrada (`entra`) es todo el
          movimiento que admite: si la sesión ya está, la marca aparece y da paso a la app sin
          que nada gire. Es el momento splash-a-app, y `useEntrada` ya respeta el ajuste de
          movimiento reducido.
        */
        <View style={s.centro}>
          <Marca lado={72} entra />
        </View>
      )}

      {fase === 'bienvenida' && (
        <Bienvenida
          onListo={() => {
            setFase(HAY_SERVIDOR ? 'entrar' : 'dentro');
            void cargarSalud();
          }}
          onSaltar={() => setFase(HAY_SERVIDOR ? 'entrar' : 'dentro')}
        />
      )}

      {fase === 'entrar' && <Entrar onDentro={(c) => void entrarDentro(c)} />}

      {fase === 'sin-conexion' && (
        /*
          Hay cuenta y no se pudo comprobar. Se dice eso, literalmente, y se ofrece reintentar.
          Ni la pantalla de entrar (mentiria: la sesion existe) ni "dentro" a ciegas (no se sabe
          ni el nombre). Es la unica pantalla nueva del arreglo y solo aparece la primera vez que
          se arranca sin red antes de tener copia local de la cuenta.
        */
        <View style={[s.centro, s.sinConexion]}>
          <Marca lado={72} />
          <Text style={s.sinConexionTitulo}>{t.sinConexionTitulo}</Text>
          <Text style={s.sinConexionTexto}>{t.sinConexionTexto}</Text>
          <Pulsable style={s.boton} accessibilityRole="button" onPress={() => void arrancar()}>
            <Text style={s.botonTexto}>{t.reintentar}</Text>
          </Pulsable>
        </View>
      )}

      {/* ── Dentro: las cinco pestañas ──────────────────────────────────────── */}
      {fase === 'dentro' && (
        <>
          {/*
            ⭐⭐ Las cinco pestañas quedan MONTADAS y se alterna con `display: none`, que es el
            patrón estándar de tabs en React Native. Antes se montaban condicionalmente, y eso
            desmontaba y remontaba la pantalla en cada cambio de pestaña, o sea que TODAS las
            animaciones de entrada (cascadas, barras creciendo 480 ms, la cifra subiendo) se
            repetían en cada visita. A la frecuencia de un cambio de pestaña eso se lee como
            retraso, no como fluidez: es la regla nº1 del propio proyecto, la tabla de frecuencia
            de Emil, que la barra cumplía y el contenido violaba. Ahora las entradas se ven una
            vez por arranque, como en la maqueta, donde el DOM sigue vivo entre pestañas.

            ⚠️ El coste es memoria de cinco árboles en vez de uno, y es barato: son listas cortas
            sin imágenes. Y el estado de scroll de cada pestaña se conserva gratis, que antes se
            perdía.
          */}
          <View style={s.cuerpo}>
            <View style={[s.pestana, pestana !== 'hoy' && s.oculta]}>
              <Hoy
                resultado={resultado}
                cargando={calculando}
                onRecargar={() => void cargarSalud()}
                perfil={perfilCabecera}
                onPerfil={() => abrirModal('perfil')}
              />
            </View>

            <View style={[s.pestana, pestana !== 'competi' && s.oculta]}>
              <Ligas
                ligas={ligas}
                ligaActiva={ligaActiva}
                onLigaActiva={setLigaActiva}
                onRecargarLigas={cargarLigas}
                irAlFeed={irAlFeed}
                onPersona={setPersona}
                yo={cuenta?.id ?? null}
                inicial={(cuenta?.nombre ?? '?').slice(0, 1).toUpperCase()}
                onCrear={() => abrirModal('crear-liga')}
                onEntrar={() => abrirModal('entrar-liga')}
                onZona={() => abrirModal('zona')}
                onMovimientos={celebrarMovimientos}
                onPrimero={celebrarLiderato}
                onAmigos={() => abrirModal('amigos')}
                onPerfil={() => abrirModal('perfil')}
                resultado={resultado}
              />
            </View>

            <View style={[s.pestana, pestana !== 'sesiones' && s.oculta]}>
              <Sesiones
                resultado={resultado}
                cargando={calculando}
                onRecargar={() => void cargarSalud()}
                onDeclararEsfuerzo={(id, rpe) => void declararEsfuerzo(id, rpe)}
                onCorregirDeporte={(id, tipo) => void corregirDeporte(id, tipo)}
                perfil={perfilCabecera}
                onPerfil={() => abrirModal('perfil')}
              />
            </View>

            <View style={[s.pestana, pestana !== 'sueno' && s.oculta]}>
              <Sueno
                datos={sueno}
                cargando={cargandoSueno}
                onRecargar={() => void cargarSueno()}
                perfil={perfilCabecera}
                onPerfil={() => abrirModal('perfil')}
              />
            </View>

            <View style={[s.pestana, pestana !== 'salud' && s.oculta]}>
              <Salud
                oms={omsActual}
                forma={formaActual}
                metricas={metricas ?? []}
                base={resultado?.base ?? null}
                cargando={cargandoMetricas || calculando}
                // ⭐ Refresco completo: métricas Y resultado. Con solo `cargarMetricas` la cifra
                // de la OMS de arriba se quedaba vieja mientras la rueda giraba.
                onRecargar={() => void refrescarSalud()}
                onDiagnostico={() => abrirModal('diagnostico')}
                perfil={perfilCabecera}
                onPerfil={() => abrirModal('perfil')}
              />
            </View>
          </View>

          {/* Flota sobre el cuerpo: el contenido pasa por debajo del cristal (ver `huecoBarra`). */}
          <Pestanas activa={pestana} onCambio={setPestana} />
        </>
      )}

      {/*
        ── Modales, ahora con la física de una hoja ──────────────────────────

        ⭐⭐ Antes aparecían con un corte instantáneo (render condicional que sustituía a las
        pestañas), mientras que TODO lo demás que tapa una pantalla en esta app (Hoja, Selector,
        DetalleSesion) usa `Modal pageSheet` con el slide nativo. Era el mismo concepto con dos
        físicas distintas, que es justo lo que Apple prohíbe: *"things that look the same must
        behave the same"*. Ahora los cuatro entran y salen por el mismo sitio, con el gesto de
        arrastre hacia abajo de regalo, así el `Volver` deja de ser la única salida.

        ⚠️ Un solo `Modal` para toda la pila, no uno por entrada: iOS apila las hojas nativas con
        efecto de profundidad, pero abrir Amigos DESDE Perfil debe sustituir el contenido de la
        misma hoja, que es lo que hace Ajustes de iOS al navegar dentro de una hoja.

        ⚠️ `onRequestClose` cubre el gesto de descarte: sin él, un swipe-down dejaría el estado
        `modales` desincronizado del modal nativo ya cerrado.
      */}
      <Modal
        visible={modal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={cerrarModal}
      >
        <View style={s.hojaModal}>
          {modal === 'amigos' && (
            <>
              <Volver
                donde={nombreVuelta}
                onPress={() => {
                  // Al volver se recargan las ligas: puede haber invitado a alguien.
                  void cargarLigas();
                  cerrarModal();
                }}
              />
              <Amigos ligas={ligas} onPersona={setPersona} />
            </>
          )}

          {modal === 'perfil' && cuenta !== null && (
            <>
              <Volver donde={t.competi} onPress={cerrarModal} />
              <Perfil
                cuenta={cuenta}
                onCambio={setCuenta}
                // ⚠️ El idioma se cambia en Perfil, y el aviso tiene que llegar HASTA AQUÍ: el
                // valor vive en una variable de módulo, así que solo un `useState` de este nivel
                // repinta también la barra de pestañas y el resto de la app.
                onIdioma={() => setIdioma(idiomaActual())}
                onAmigos={() => abrirModal('amigos')}
                // Cerrar sesion o borrar cuenta: se limpia todo y se vuelve al principio.
                onFuera={fueraDeLaCuenta}
              />
            </>
          )}

          {(modal === 'crear-liga' || modal === 'entrar-liga') && (
            <NuevaLiga
              modo={modal === 'crear-liga' ? 'crear' : 'entrar'}
              // El código del enlace de invitación, ya puesto: solo queda confirmar.
              codigoInicial={modal === 'entrar-liga' ? (codigoEnlace ?? undefined) : undefined}
              onHecho={(ligaId) => {
                // Entrar en una liga es un logro: toque de éxito al cerrarse la hoja.
                hapticaExito();
                setCodigoEnlace(null);
                cerrarModal();
                // Primero la lista, luego la elección: si se eligiera antes de que la lista
                // traiga la liga nueva, el candado de `ligaActiva` la devolvería a la primera.
                void cargarLigas().then(() => setLigaActiva(ligaId));
              }}
              onCancelar={() => {
                // Cancelar también gasta el código: reabrir la misma invitación en bucle
                // convertiría el enlace en una trampa.
                setCodigoEnlace(null);
                cerrarModal();
              }}
            />
          )}

          {/* Unirse a la liga pública de tu ciudad y distrito, o cambiar de zona. */}
          {modal === 'zona' && (
            <Zona
              ligas={ligas}
              onHecho={() => {
                hapticaExito();
                void cargarLigas();
                cerrarModal();
              }}
              onCancelar={cerrarModal}
            />
          )}

          {/*
            Diagnostico: mide si los pulsos llegan con detalle suficiente. Estaba escrito y sin
            acceso desde ningun sitio, asi que ahora se entra desde la pestaña Salud, que es
            precisamente la que espera esa respuesta.
          */}
          {modal === 'diagnostico' && (
            <>
              <Volver donde={t.tabSalud} onPress={cerrarModal} />
              <Diagnostico />
            </>
          )}
        </View>
      </Modal>

      {/* La celebración va encima de todo. Al cerrarla se persiste que ya se vio. */}
      {fiesta !== null && (
        <Celebracion
          visible
          icono={fiesta.icono}
          cifra={fiesta.cifra}
          titulo={fiesta.titulo}
          frase={fiesta.frase}
          rgb={fiesta.rgb}
          confetti={fiesta.confetti}
          onCerrar={() => {
            void marcaCelebrado(almacenNativo(), fiesta.momento).catch(() => undefined);
            setFiesta(null);
          }}
        />
      )}

      {/*
        La ficha de una persona (sus entrenos). Es una hoja nativa, así que se abre igual desde la
        tabla de la liga, desde el feed o desde el modal de Amigos, encima de lo que haya.
      */}
      <Persona persona={persona} yo={cuenta?.id ?? null} onCerrar={() => setPersona(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  // `flex: 1` para que la pestaña ocupe el hueco y la barra quede pegada abajo.
  cuerpo: { flex: 1 },
  // Cada pestaña llena el cuerpo. La inactiva se oculta SIN desmontarse, que es lo que evita
  // repetir las animaciones de entrada en cada visita.
  pestana: { flex: 1 },
  oculta: { display: 'none' },
  // Contenido de la hoja modal. El fondo lo pone la propia hoja, no la pantalla de debajo.
  hojaModal: { flex: 1, backgroundColor: tema.color.fondo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  volver: {
    minHeight: tema.tactil,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: tema.espacio.l,
    // Dentro de una hoja `pageSheet` no hay isla dinámica que esquivar: la hoja ya cuelga
    // por debajo. Basta el espacio de una cabecera.
    paddingTop: tema.espacio.m,
  },
  volverTexto: { ...tema.tipo.cuerpo, color: tema.color.marca },
  // Pantalla de "sin conexion". Mismo lenguaje que los estados vacios de Ligas: titulo grande
  // porque no compite con ninguna cifra, texto suave, un boton de marca.
  sinConexion: { padding: tema.espacio.l, gap: tema.espacio.m },
  sinConexionTitulo: {
    fontSize: 22,
    fontWeight: '600',
    color: tema.color.texto,
    textAlign: 'center',
    marginTop: tema.espacio.m,
  },
  sinConexionTexto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, textAlign: 'center' },
  boton: {
    backgroundColor: tema.color.marca,
    minHeight: tema.tactil,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tema.espacio.l,
    borderRadius: tema.radio.m,
    marginTop: tema.espacio.s,
  },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
});
