import { Linking } from 'react-native';

/**
 * How a missing value is counted.
 *
 * iOS does not reveal whether the user denied read access: an empty result can mean "I was not
 * wearing the band" or "you have no permission", and the two are indistinguishable. So the app
 * claims neither.
 *
 * Same rule everywhere in the app: a day without data is not a zero, it means the band was not
 * on the wrist.
 */

export type DataState<T> =
  | { present: true; value: T }
  /** Queried and nothing came back. No permission or no band: cannot be told apart. */
  | { present: false; reason: 'no-data' }
  /** This device has no HealthKit (iPad, old simulator). */
  | { present: false; reason: 'unavailable' };

export function withData<T>(value: T): DataState<T> {
  return { present: true, value };
}

export function noData<T>(): DataState<T> {
  return { present: false, reason: 'no-data' };
}

/** Turns a list of samples into a DataState without inventing zeros. */
export function fromSamples<T>(samples: readonly T[]): DataState<readonly T[]> {
  return samples.length > 0 ? withData(samples) : noData();
}

/** Opens Settings > Privacy > Health > Compety so the user can review permissions. */
export function openSettings(): Promise<void> {
  return Linking.openSettings();
}
