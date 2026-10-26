import { claimUniqueBlockId, GENERATED_BLOCK_ID_LENGTH, randomBlockId } from './blockId';

describe('randomBlockId', () => {
  it('WHEN generating THEN the id is 6 lowercase letters or digits', () => {
    expect(randomBlockId()).toMatch(new RegExp(`^[a-z0-9]{${GENERATED_BLOCK_ID_LENGTH}}$`));
  });
});

describe('claimUniqueBlockId', () => {
  describe('GIVEN a source whose first id is taken', () => {
    const candidates = ['taken', 'free'];

    it('WHEN claiming THEN the next unused id is returned', () => {
      const queue = [...candidates];
      expect(claimUniqueBlockId(() => queue.shift()!, new Set(['taken']))).toBe('free');
    });
  });

  it('GIVEN a source that only repeats a taken id WHEN claiming THEN it throws instead of looping forever', () => {
    expect(() => claimUniqueBlockId(() => 'same', new Set(['same']))).toThrow(/No unused block id/);
  });
});
