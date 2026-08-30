import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { sincroniza } from '../datos/sincroniza';

/**
 * Sincronizacion en segundo plano.
 *
 * ⚠️ Expectativas realistas, y estan documentadas por la propia libreria de HealthKit: la
 * entrega en segundo plano NO es tiempo real. Puede tardar minutos u horas incluso con
 * frecuencia immediate, lo decide iOS, se recorta con bateria baja, y si la persona fuerza el
 * cierre de la app la entrega se detiene hasta que la vuelva a abrir.
 *
 * ⇒ Se disena para "casi en vivo" con tres vias que se solapan:
 *   1. Esta tarea de segundo plano.
 *   2. El observador de HealthKit, que activa el plugin.
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
 * Registra la tarea. Idempotente: si ya estaba registrada no hace nada.
 *
 * El intervalo es una peticion, no una garantia. iOS decide cuando ejecutar segun uso, bateria
 * y red.
 */
export async function registrarSegundoPlano(): Promise<boolean> {
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
