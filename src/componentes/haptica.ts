import * as Haptics from 'expo-haptics';

/**
 * Respuesta táctil, solo en los momentos que la merecen.
 *
 * ⭐ Rediseño del 15 sep. Las tres reglas de Apple para combinar sentidos (*Designing
 * Audio-Haptic Experiences*), aplicadas a esta app:
 *
 *   Causalidad  se dispara en el hecho, no cerca de él: al aparecer la celebración, al enviar
 *               la reacción, al soltar el pull-to-refresh cuando ya va a recargar.
 *   Armonía     en el MISMO fotograma que lo visual. Por eso las funciones son síncronas de
 *               cara afuera (la promesa se suelta) y se llaman junto al `setState` o al
 *               `start()` de la animación, nunca en un `then`.
 *   Utilidad    nada en cambiar de pestaña ni al pulsar filas: *"over-feedback trains users to
 *               ignore all of it"*. Lo que se toca cien veces al día no vibra.
 *
 * ⚠️ Los errores se tragan a propósito: en un dispositivo sin motor háptico o con la háptica del
 * sistema apagada la llamada rechaza, y eso nunca debe romper la acción que la acompaña.
 */

/** Un logro: la celebración aparece, entras en una liga. */
export function hapticaExito(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/** Un toque que confirma algo pequeño: una reacción enviada. */
export function hapticaLigera(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Algo se ha soltado y ya va: el pull-to-refresh al pasar el umbral. */
export function hapticaMedia(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}
