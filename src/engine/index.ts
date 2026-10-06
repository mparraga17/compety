/**
 * Example scoring engine.
 *
 * ⚠️ This is NOT the engine that ships in Compety. The real one (calibrated sport factors,
 * duration compression, zone calibration, discounts for sessions without heart rate, merging
 * of duplicate sources) is private.
 *
 * What is here is the textbook version of the same idea, so the rest of the code compiles,
 * the tests run and you can see where an engine plugs in:
 *
 *   - Heart-rate zones as a percentage of a maximum heart rate.
 *   - Edwards TRIMP: minutes in each zone multiplied by the zone number (1 to 5).
 *     Edwards, S. (1993). The Heart Rate Monitor Book.
 *   - Load = TRIMP. No sport factor, no compression of long sessions.
 *
 * Swap this folder for your own engine and keep the same exports.
 */

/** Health tab metric keys. Shared with `health/types.ts`, which checks them at compile time. */
export type MetricKey = 'hrv' | 'restingHr' | 'spo2' | 'respiration' | 'vo2max' | 'steps';

/** A heart-rate sample as read from HealthKit. */
export type HeartRateSample = { value: number; start: Date; end: Date };

// ─── Sport types ─────────────────────────────────────────────────────────────────────────────

/**
 * HealthKit sends the workout type as a number (`HKWorkoutActivityType`). A few common ones,
 * enough for the example. The full table lives in Apple's documentation.
 */
const ACTIVITY: Readonly<Record<number, string>> = {
  13: 'cycling',
  20: 'functionalStrength',
  21: 'golf',
  37: 'running',
  46: 'swimming',
  48: 'tennis',
  50: 'traditionalStrength',
  52: 'walking',
  57: 'yoga',
  66: 'pilates',
  79: 'pickleball',
  80: 'barre',
};

/** Sport name for a HealthKit activity code, or null when the code is unknown. */
export function activityTypeOf(code: number | string | null | undefined): string | null {
  if (code == null) return null;
  const n = typeof code === 'number' ? code : Number(code);
  return Number.isFinite(n) ? (ACTIVITY[n] ?? null) : null;
}

// ─── Maximum heart rate ──────────────────────────────────────────────────────────────────────

/** Fallback maximum when there is not enough history. */
export const FALLBACK_MAX = 190;

/** Minimum number of samples before the observed maximum is trusted. */
export const MIN_SAMPLES = 500;

export type ReferenceMax = {
  value: number;
  /** true when there was not enough history and the fallback was used. */
  provisional: boolean;
  observed: number | null;
  samples: number;
};

/**
 * Reference maximum heart rate from the user's own history.
 *
 * Uses the 99th percentile instead of the absolute maximum, so a single optical-sensor spike
 * does not move every zone. Formulas like 220 minus age are a population average and miss by
 * 10 to 20 bpm for many individuals, which is why history wins when there is enough of it.
 */
export function referenceMax(bpm: readonly number[]): ReferenceMax {
  if (bpm.length === 0) {
    return { value: FALLBACK_MAX, provisional: true, observed: null, samples: 0 };
  }
  const sorted = [...bpm].sort((a, b) => a - b);
  const observed = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
  const trusted = bpm.length >= MIN_SAMPLES;
  return {
    value: trusted ? observed : Math.max(observed, FALLBACK_MAX),
    provisional: !trusted,
    observed,
    samples: bpm.length,
  };
}

// ─── Zones and TRIMP ─────────────────────────────────────────────────────────────────────────

/** Lower bound of each Edwards zone, as a fraction of maximum heart rate. */
export const ZONE_BOUNDS = [0.5, 0.6, 0.7, 0.8, 0.9] as const;

export type Zones = {
  /** Seconds spent in each of the five zones. */
  seconds: readonly [number, number, number, number, number];
  /** Edwards TRIMP: sum of minutes in zone times zone number. */
  trimp: number;
  /** TRIMP per minute in zone, or null when no time reached zone 1. */
  intensity: number | null;
  maxUsed: number;
};

function zoneOf(bpm: number, max: number): number {
  const fraction = bpm / max;
  for (let z = ZONE_BOUNDS.length - 1; z >= 0; z--) {
    if (fraction >= ZONE_BOUNDS[z]) return z;
  }
  return -1; // below 50%: does not count
}

/**
 * Time in zones from raw samples. Each sample covers the time until the next one, capped at
 * five minutes so a gap in the data is not counted as effort.
 */
export function computeZones(samples: readonly HeartRateSample[], max: number): Zones | null {
  if (samples.length < 2) return null;

  const seconds: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (let i = 0; i < samples.length - 1; i++) {
    const gap = (samples[i + 1].start.getTime() - samples[i].start.getTime()) / 1000;
    const covered = Math.max(0, Math.min(gap, 300));
    const z = zoneOf(samples[i].value, max);
    if (z >= 0) seconds[z] += covered;
  }

  const trimp = seconds.reduce((sum, s, z) => sum + (s / 60) * (z + 1), 0);
  const minutesInZone = seconds.reduce((a, b) => a + b, 0) / 60;

  return {
    seconds,
    trimp: +trimp.toFixed(1),
    intensity: minutesInZone > 0 ? +(trimp / minutesInZone).toFixed(2) : null,
    maxUsed: max,
  };
}

// ─── Load ────────────────────────────────────────────────────────────────────────────────────

export type Load = {
  value: number;
  /** Where the number came from. The example only knows measured sessions. */
  origin: 'measured';
};

/**
 * Load of a session with heart rate. In the example it is plain TRIMP: intensity times minutes.
 *
 * This is where a real engine adds what makes scores fair across sports and durations. Plain
 * TRIMP grows almost linearly with time, so four easy hours outscore one hard hour.
 */
export function measuredLoad(input: { sport: string; minutes: number; intensity: number }): Load {
  return { value: +(input.intensity * input.minutes).toFixed(1), origin: 'measured' };
}
