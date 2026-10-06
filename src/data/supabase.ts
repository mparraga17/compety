import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';

/**
 * Supabase client.
 *
 * ⚠️ What goes up and what does NOT. Only the score travels to the server, never heart rate,
 * sleep or zones. The math runs on the phone. Reasons: GDPR, less damage in a leak, lower cost,
 * and Apple's guideline 5.1.3.
 *
 * A good side effect, on purpose: the server has no health data to leak even if it wanted to,
 * so notifications to other people cannot break the HealthKit rule even by accident.
 *
 * The anon key is public by design: it gives access to nothing without passing row level
 * security. It still lives in environment variables so it is not pinned in the repo.
 *
 * Table names (`perfiles` = profiles, and so on) are the live database's names. They stay as
 * they are because installed versions of the app use them.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** false while there are no credentials. The app works on its own without a server. */
export const HAS_SERVER = url.length > 0 && key.length > 0;

export const supabase = createClient(url || 'http://localhost', key || 'no-key', {
  auth: {
    // AsyncStorage so the session survives closing the app.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // React Native has no URL fragment to detect.
    detectSessionInUrl: false,
  },
});

/**
 * Id of the signed-in user. THROWS if there is none.
 *
 * ⛔ It replaced an `if (user === undefined) return;` pattern that lived in five places. That
 * silent `return` was the bug: with a dead session, uploading a score "finished fine" without
 * uploading anything, the upload counter kept going up and the background task accepted a sync
 * that had done nothing. A write that cannot happen must fail where it can be seen.
 *
 * It separates two causes, because the error messages differ:
 *   - no network while refreshing the token (`getSession` returns a null session WITH a
 *     retryable error, verified in supabase-js): that error is propagated, "No connection".
 *   - genuinely no session: "sign in again".
 */
export async function currentUser(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (id !== undefined) return id;
  if (error !== null && isAuthRetryableFetchError(error)) throw error;
  throw new Error('hace falta sesion'); // same text the SQL functions use
}
