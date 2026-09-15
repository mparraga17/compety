import {
  configureBackgroundTypes,
  subscribeToChanges,
  UpdateFrequency,
} from '@kingstinct/react-native-healthkit';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { CLAVES } from '../datos/almacen';
import { almacenNativo } from '../datos/almacenNativo';
import { sincroniza } from '../datos/sincroniza';
import { estadoPermisos } from '../salud/permisos';

/**
 * Sincronizacion en segundo plano.
 *
 * ⚠️ Expectativas realistas, y estan documentadas por la propia libreria de HealthKit: la
 * entrega en segundo plano NO es tiempo real. Puede tardar minutos u horas incluso con
 * frecuencia immediate, lo decide iOS, se recorta con bateria baja, y si la persona fuerza el
 * cierre de la app la entrega se detiene hasta que la vuelva a abrir.
 *
 * ⇒ Se disena para "casi en vivo" con tres vias que se solapan:
 *   1. El observador de HealthKit (abajo): iOS despierta la app cuando se escribe un entreno.
 *      Es la via principal, porque se dispara con el dato y no con un temporizador.
 *   2. Esta tarea de segundo plano, de respaldo: un barrido periodico por si el observador
 *      no llego a completar su subida.
 *   3. Sincronizar al abrir la app, que es la que nunca falla.
 *
 * Y el motivo de que un aviso perdido no deje hueco es la idempotencia: la puntuacion se
 * sobreescribe por clave primaria y el aviso lleva huella unica.
 */

export const TAREA = 'compety-sincroniza';

TaskManager.defineTask(TAREA, async () => {
  try {
    const r = await sincroniza();
    // Si no habia nada que subir se declara, para que iOS no penalice ejecuciones inutiles.
    return r.subidas > 0
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * ⭐ Via 1: el observador de HealthKit.
 *
 * Sin esto las otras dos vias no bastan, y fue un fallo real: los avisos "tu amigo ha
 * entrenado" solo salian cuando quien entrenaba ABRIA la app, porque la subida al servidor
 * solo ocurria ahi (la tarea periodica de iOS se ejecuta cuando el sistema quiere, que en la
 * practica es tarde o nunca). Quien entrena y no abre Compety no aparecia en el feed ni
 * disparaba avisos, aunque su pulsera hubiera escrito el entreno en HealthKit.
 *
 * Como funciona, verificado en el codigo de la libreria (BackgroundDeliveryManager.swift):
 *
 * - `configureBackgroundTypes` persiste los tipos en UserDefaults y desde entonces el
 *   AppDelegate registra el HKObserverQuery en cada arranque EN FRIO, antes de que exista JS.
 *   Eso es lo que sobrevive a que iOS mate la app. El plugin de app.json (`background: true`)
 *   ya dejo puesto el entitlement y la llamada en el AppDelegate; sin esta llamada desde JS,
 *   aquello era un cascaron vacio.
 * - Cuando HealthKit despierta la app, el nativo abre una ventana de ~25 s para que Hermes
 *   arranque, y ENCOLA el evento hasta que este fichero se importa y se suscribe: la
 *   suscripcion de abajo vacia esa cola. Por eso vive a nivel de modulo y no en un efecto de
 *   React: tiene que existir en cuanto arranca el bundle, tambien en un arranque en segundo
 *   plano donde nadie navega la app.
 *
 * Solo se observan los entrenos. Observar los pulsos despertaria la app decenas de veces al
 * dia (Fitbit los vuelca en lotes continuamente) para no contar nada nuevo: sin entreno nuevo
 * no cambia ninguna puntuacion.
 */

/** Candado: los cambios pueden llegar en rafaga y una sincronizacion ya lo recoge todo. */
let sincronizando = false;
let repetir = false;

async function alCambiarEntrenos(): Promise<void> {
  if (sincronizando) {
    // Ya hay una en marcha: se apunta una vuelta mas para recoger lo que llego durante ella.
    repetir = true;
    return;
  }
  sincronizando = true;
  try {
    do {
      repetir = false;
      // Sin permisos preguntados no se sincroniza: si no, `preparar()` abriria la hoja de
      // permisos del sistema en mitad de la bienvenida (o en un arranque en segundo plano).
      const estado = await estadoPermisos();
      if (estado.tipo !== 'preguntado') return;
      await sincroniza();
    } while (repetir);
  } catch {
    // Sin red o sin sesion no se puede subir. No se pierde nada: la puntuacion es idempotente
    // y el siguiente disparo, la tarea periodica o abrir la app lo reintentan.
  } finally {
    sincronizando = false;
  }
}

subscribeToChanges('HKWorkoutTypeIdentifier', () => {
  void alCambiarEntrenos();
});

/**
 * Firma de lo configurado. Si algun dia se observan mas tipos, cambiar la firma y el proximo
 * arranque reconfigura solo.
 */
const OBSERVADOR = 'v1:HKWorkoutTypeIdentifier';

/**
 * Configura la entrega en segundo plano UNA vez y deja constancia.
 *
 * ⚠️ No se llama en cada arranque a proposito: `configureBackgroundTypes` desmonta y vuelve a
 * montar los observadores nativos, y ese desmontaje tira el callback de la suscripcion de
 * arriba en las sesiones siguientes (el nativo encolaria sin entregar hasta el proximo
 * arranque). Configurado queda configurado: lo persiste UserDefaults.
 */
async function configurarObservador(): Promise<void> {
  try {
    const almacen = almacenNativo();
    if ((await almacen.leer(CLAVES.observador)) === OBSERVADOR) return;

    const ok = await configureBackgroundTypes(['HKWorkoutTypeIdentifier'], UpdateFrequency.immediate);
    if (ok) await almacen.guardar(CLAVES.observador, OBSERVADOR);
  } catch {
    // Sin HealthKit (Android, web) no hay nada que configurar. Se reintenta en cada arranque
    // mientras no quede constancia, asi que un fallo puntual no deja esto a medias.
  }
}

/**
 * Registra las vias 1 y 2. Idempotente: si ya estaban registradas no hace nada.
 *
 * El intervalo de la tarea es una peticion, no una garantia. iOS decide cuando ejecutar segun
 * uso, bateria y red.
 */
export async function registrarSegundoPlano(): Promise<boolean> {
  await configurarObservador();

  try {
    const estado = await BackgroundTask.getStatusAsync();
    if (estado === BackgroundTask.BackgroundTaskStatus.Restricted) return false;

    const registrada = await TaskManager.isTaskRegisteredAsync(TAREA);
    if (registrada) return true;

    await BackgroundTask.registerTaskAsync(TAREA, { minimumInterval: 60 });
    return true;
  } catch {
    return false;
  }
}

export async function pararSegundoPlano(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TAREA)) {
      await BackgroundTask.unregisterTaskAsync(TAREA);
    }
  } catch {
    // Que no se pueda desregistrar no debe tumbar nada.
  }
}
