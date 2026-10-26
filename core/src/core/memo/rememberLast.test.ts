import { rememberLast } from './rememberLast';

describe('GIVEN a remembered two-argument computation', () => {
  let calls: number;
  let combine: (a: object, b: object) => { calls: number };
  const first = {};
  const second = {};
  beforeEach(() => {
    calls = 0;
    combine = rememberLast((_a: object, _b: object) => {
      calls += 1;
      return { calls };
    });
  });

  it('WHEN called twice with the same objects THEN the computation runs once', () => {
    combine(first, second);
    combine(first, second);
    expect(calls).toBe(1);
  });

  it('WHEN called twice with the same objects THEN the same result object comes back', () => {
    expect(combine(first, second)).toBe(combine(first, second));
  });

  it('WHEN one argument is a different object THEN it computes again', () => {
    combine(first, second);
    combine(first, {});
    expect(calls).toBe(2);
  });

  it('WHEN an argument is an equal but new object THEN it computes again (identity, not deep equality)', () => {
    combine(first, { ...second });
    combine(first, { ...second });
    expect(calls).toBe(2);
  });

  it('WHEN the arguments go back to an earlier pair THEN it computes again (one slot only)', () => {
    combine(first, second);
    combine(first, {});
    combine(first, second);
    expect(calls).toBe(3);
  });
});
