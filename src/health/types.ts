import type { MetricKey } from '../engine';

/**
 * Single source of truth for what Compety reads from HealthKit.
 *
 * Why this file exists: the HealthKit library crashes the app if you query a type you did not
 * include in requestAuthorization. Declaring the types here and deriving the TypeScript type
 * from them means that asking for something unauthorised does not compile. The bug is caught
 * on a Windows machine, not on the iPhone.
 */

/** Types requested on the permission sheet. Add them here and nowhere else. */
export const TYPES_TO_READ = [
  // Core of the metric: heart rate per session -> heart-rate zones -> Edwards TRIMP
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierHeartRate',

  // Session context
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierStepCount',

  // Health tab (informational, never scores)
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierVO2Max',
  // Note: HRV does not arrive from Fitbit or WHOOP. It is requested for Oura and Apple Watch
  // users, but it does NOT score anything, or owning a specific brand would be rewarded.
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
] as const;

/** Only these types can be read. Any other is a compile error. */
export type ReadableType = (typeof TYPES_TO_READ)[number];

/**
 * Compety never writes to HealthKit. Apple forbids writing false data (guideline 5.1.3.ii)
 * and there is no product reason to write.
 */
export const TYPES_TO_WRITE = [] as const;

/**
 * Health tab metrics, with the HealthKit type each one comes from.
 *
 * ⚠️ `key` must match `MetricKey` in the engine, where the rest of the definition lives. The
 * `satisfies` below checks it at compile time, so renaming a key in one place only does not
 * compile.
 */
export const HEALTH_METRICS = [
  { type: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', key: 'hrv' },
  { type: 'HKQuantityTypeIdentifierRestingHeartRate', key: 'restingHr' },
  { type: 'HKQuantityTypeIdentifierOxygenSaturation', key: 'spo2' },
  { type: 'HKQuantityTypeIdentifierRespiratoryRate', key: 'respiration' },
  { type: 'HKQuantityTypeIdentifierVO2Max', key: 'vo2max' },
  { type: 'HKQuantityTypeIdentifierStepCount', key: 'steps' },
] as const satisfies readonly { type: ReadableType; key: MetricKey }[];
