import { fontFetcherFromBytes } from './fontBytes';

describe('fontFetcherFromBytes', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const fetcher = fontFetcherFromBytes(new Map([['https://fonts.example/kalam.ttf', bytes]]));

  it('GIVEN a bundled URL THEN it resolves with a copy of the bytes', async () => {
    const buffer = await fetcher('https://fonts.example/kalam.ttf');
    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3]);
  });

  it('GIVEN a bundled URL THEN the returned buffer is not the bundled one (a fresh copy per load)', async () => {
    const buffer = await fetcher('https://fonts.example/kalam.ttf');
    expect(buffer).not.toBe(bytes.buffer);
  });

  it('GIVEN a URL that is not bundled THEN it rejects instead of fetching', async () => {
    await expect(fetcher('https://cdn.example/other.ttf')).rejects.toThrow('not bundled');
  });
});
