/**
 * Where a notification takes you when tapped. Pure JS, kept apart from `push.ts` (which pulls
 * in Expo's native modules) so it can be tested on Windows.
 */

/** What a notification carries when tapped. It is the `data` set by the server's send function. */
export type NotificationTarget =
  | { kind: 'league'; league: string }
  | { kind: 'friends' }
  | { kind: 'feed'; workout: string | null };

/**
 * Turns a notification's `data` into where the app should go.
 *
 * `lead_change` goes to the league; `friend_request` and `friend_accepted` to the friends inbox;
 * `reaction`, `comment` and `workout` to the feed. Anything else, or broken data, goes nowhere.
 *
 * ⭐ A friend's `workout` notification belongs to friends, not to a league, so it opens the feed,
 * which is where that session lives; if the server resolved the workout, that one opens.
 * OLDER workout notifications carried a league: they still open the league.
 *
 * The `kind` values in the payload are the server's wire format and stay stable, so installed
 * versions of the app keep working.
 */
export function targetOf(data: unknown): NotificationTarget | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as { clase?: unknown; liga?: unknown; entreno?: unknown };
  switch (d.clase) {
    case 'sesion': // a friend's workout
      return typeof d.liga === 'string'
        ? { kind: 'league', league: d.liga }
        : { kind: 'feed', workout: typeof d.entreno === 'string' ? d.entreno : null };
    case 'liderato': // lead change
      return typeof d.liga === 'string' ? { kind: 'league', league: d.liga } : null;
    case 'amistad': // friend request
    case 'amistad_aceptada': // friend accepted
      return { kind: 'friends' };
    case 'reaccion': // reaction
    case 'comentario': // comment
      return { kind: 'feed', workout: typeof d.entreno === 'string' ? d.entreno : null };
    default:
      return null;
  }
}
