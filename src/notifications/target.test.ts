import { targetOf } from './target';

describe('where a notification goes when tapped', () => {
  test('league notifications open that league', () => {
    // An OLD workout notification carried a league: it still opens it.
    expect(targetOf({ clase: 'sesion', liga: 'L1' })).toEqual({ kind: 'league', league: 'L1' });
    expect(targetOf({ clase: 'liderato', liga: 'L1' })).toEqual({ kind: 'league', league: 'L1' });
    // A lead change without a league has nowhere to go: staying put beats opening the wrong thing.
    expect(targetOf({ clase: 'liderato' })).toBeNull();
  });

  test("a friend's workout opens the feed, on that workout when it is resolved", () => {
    expect(targetOf({ clase: 'sesion', entreno: 'E1' })).toEqual({ kind: 'feed', workout: 'E1' });
    expect(targetOf({ clase: 'sesion' })).toEqual({ kind: 'feed', workout: null });
  });

  test('friend requests and acceptances open the friends inbox', () => {
    expect(targetOf({ clase: 'amistad' })).toEqual({ kind: 'friends' });
    expect(targetOf({ clase: 'amistad_aceptada' })).toEqual({ kind: 'friends' });
  });

  test('reactions and comments open the feed, with the workout when present', () => {
    expect(targetOf({ clase: 'reaccion', entreno: 'E1' })).toEqual({ kind: 'feed', workout: 'E1' });
    expect(targetOf({ clase: 'comentario' })).toEqual({ kind: 'feed', workout: null });
  });

  test('broken or unknown data goes nowhere', () => {
    expect(targetOf(null)).toBeNull();
    expect(targetOf('sesion')).toBeNull();
    expect(targetOf({ clase: 'other' })).toBeNull();
    expect(targetOf({})).toBeNull();
  });
});
