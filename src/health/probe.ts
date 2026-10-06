import { queryQuantitySamples } from '@kingstinct/react-native-healthkit';

import { prepare } from './permissions';
import { TYPES_TO_READ, type ReadableType } from './types';

/**
 * Permission probe, one type at a time.
 *
 * It exists because iOS does not say what the user granted for reading: without permission, a
 * query returns empty exactly as if there were no data. The only way to get close is to query
 * each type separately and look at the pattern.
 *
 * How to read the result:
 *   ALL at 0          the global permission failed, or requestAuthorization never resolved
 *   some yes, some 0  the ones at 0 have no permission, or no data
 */

export type Probe = {
  type: ReadableType;
  samples: number;
  latest: Date | null;
  error: string | null;
};

/** Quantity types, the only ones that can be probed with queryQuantitySamples. */
const PROBEABLE = TYPES_TO_READ.filter((t) =>
  t.startsWith('HKQuantityTypeIdentifier'),
) as readonly ReadableType[];

export async function probe(days = 30): Promise<readonly Probe[]> {
  await prepare();

  const since = new Date();
  since.setDate(since.getDate() - days);

  const results: Probe[] = [];

  for (const type of PROBEABLE) {
    try {
      const samples = await queryQuantitySamples(type as 'HKQuantityTypeIdentifierStepCount', {
        limit: 0,
        filter: { date: { startDate: since } },
        ascending: false,
      });
      results.push({
        type,
        samples: samples.length,
        latest: samples.length > 0 ? samples[0].startDate : null,
        error: null,
      });
    } catch (e) {
      results.push({
        type,
        samples: 0,
        latest: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}

/** Short name for the interface. */
export function shortName(type: string): string {
  return type
    .replace('HKQuantityTypeIdentifier', '')
    .replace('HKCategoryTypeIdentifier', '')
    .replace('HKWorkoutTypeIdentifier', 'Workout');
}
