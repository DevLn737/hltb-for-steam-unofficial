import { describe, expect, it } from 'vitest';
import { findStrictMatch, normalizeTitle } from '../src/core/title-matcher';

describe('strict title matching', () => {
  it('normalizes punctuation without dropping meaningful words', () => {
    expect(normalizeTitle('Trails™ in the Sky: 1st Chapter')).toBe('trails in the sky 1st chapter');
  });

  it('accepts an exact normalized title', () => {
    const match = findStrictMatch('Trails in the Sky 1st Chapter', [
      { id: 1, name: 'Trails in the Sky 1st Chapter' },
      { id: 2, name: 'Trails in the Sky' },
    ]);
    expect(match?.candidate.id).toBe(1);
    expect(match?.score).toBe(1);
  });

  it('rejects weak substring matches that could return unrelated times', () => {
    expect(findStrictMatch('Trails in the Sky 1st Chapter', [
      { id: 2, name: 'Trails in the Sky' },
      { id: 3, name: 'The First Chapter' },
    ])).toBeNull();
  });

  it('accepts an exact HLTB alias', () => {
    const match = findStrictMatch('A Game: Complete Edition', [
      { id: 4, name: 'A Game', aliases: 'A Game: Complete Edition' },
    ]);
    expect(match?.candidate.id).toBe(4);
  });
});

