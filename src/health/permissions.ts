import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import { TYPES_TO_READ } from './types';

/**
 * Single gate to HealthKit.
 *
 * No screen calls the library directly: everything goes through prepare(). That makes it
 * impossible to query before authorization was requested, which is what crashes the app.
 *
 * An iOS limit shapes everything below: for privacy, an app CANNOT know whether the user
 * granted READ access. Without access, a query returns empty, exactly as if there were no data.
 * https://developer.apple.com/documentation/healthkit/hkhealthstore/1614152-requestauthorization
 *
 * Product consequence: never claim "you have no data". See health/status.ts.
 */

export type PermissionStatus =
  | { kind: 'unavailable' }
  | { kind: 'not-asked' }
  | { kind: 'asked' };

/** Shared promise: the system sheet is shown only once. */
let authorization: Promise<boolean> | null = null;

export function hasHealthKit(): boolean {
  return isHealthDataAvailable();
}

/**
 * Requests authorization if needed and resolves once queries are allowed.
 * Idempotent: calling it many times never reopens the sheet.
 */
export function prepare(): Promise<boolean> {
  authorization ??= requestAuthorization({ toRead: TYPES_TO_READ }).catch((error) => {
    // On failure, reset so the next launch can retry.
    authorization = null;
    throw error;
  });
  return authorization;
}

/**
 * Whether every type has already been asked for. It does NOT say what was granted: iOS does
 * not tell. Used to decide between the welcome screen and going straight to the data.
 */
export async function permissionStatus(): Promise<PermissionStatus> {
  if (!isHealthDataAvailable()) return { kind: 'unavailable' };

  const status = await getRequestStatusForAuthorization({ toRead: TYPES_TO_READ });
  // shouldRequest = 1: some types were never asked. unnecessary = 2: all were asked.
  return status === 1 ? { kind: 'not-asked' } : { kind: 'asked' };
}
