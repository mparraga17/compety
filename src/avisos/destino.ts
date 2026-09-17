/**
 * A dónde lleva un aviso al tocarlo. JS puro, separado de `push.ts` (que arrastra los módulos
 * nativos de Expo) para poder probarlo en Windows.
 */

/** Lo que trae un aviso al tocarlo. Es el `data` que pone la Edge Function `enviar-aviso`. */
export type DestinoAviso =
  | { tipo: 'liga'; liga: string }
  | { tipo: 'amigos' }
  | { tipo: 'feed'; entreno: string | null };

/**
 * Traduce el `data` de un aviso a dónde tiene que ir la app.
 *
 * `liderato` lleva a la liga; `amistad` y `amistad_aceptada` a la bandeja de amigos; `reaccion`,
 * `comentario` y `sesion` al feed. Cualquier otra cosa, o datos rotos, no lleva a ningún sitio.
 *
 * ⭐ `sesion` (migración 14, 17 sep): el aviso de que un amigo ha entrenado ya no es de liga sino de
 * amigos, así que lleva al feed, que es donde está esa sesión; si la Edge Function resolvió el
 * entreno, se abre ese. Los avisos de sesión ANTIGUOS traían liga: siguen llevando a la liga.
 */
export function destinoDe(data: unknown): DestinoAviso | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as { clase?: unknown; liga?: unknown; entreno?: unknown };
  switch (d.clase) {
    case 'sesion':
      return typeof d.liga === 'string'
        ? { tipo: 'liga', liga: d.liga }
        : { tipo: 'feed', entreno: typeof d.entreno === 'string' ? d.entreno : null };
    case 'liderato':
      return typeof d.liga === 'string' ? { tipo: 'liga', liga: d.liga } : null;
    case 'amistad':
    case 'amistad_aceptada':
      return { tipo: 'amigos' };
    case 'reaccion':
    case 'comentario':
      return { tipo: 'feed', entreno: typeof d.entreno === 'string' ? d.entreno : null };
    default:
      return null;
  }
}
