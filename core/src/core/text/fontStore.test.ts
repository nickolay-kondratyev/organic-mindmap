import { vendoredKalamBytes } from '../../../test-support/vendoredKalam';
import { FontStore, type FontFetcher } from './fontStore';

const URL_A = 'https://fonts.test/a.ttf';

/** Fetcher whose result the test settles explicitly. */
function deferredFetcher() {
  let settle: { resolve: (bytes: ArrayBuffer) => void; reject: (error: Error) => void } | null = null;
  const calls: string[] = [];
  const fetcher: FontFetcher = (url) => {
    calls.push(url);
    return new Promise((resolve, reject) => {
      settle = { resolve, reject };
    });
  };
  return {
    fetcher,
    calls,
    resolve: (bytes: ArrayBuffer) => settle?.resolve(bytes),
    reject: (error: Error) => settle?.reject(error),
  };
}

describe('FontStore', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN a fresh store WHEN loading a URL THEN its status is loading', () => {
    const store = new FontStore(deferredFetcher().fetcher, () => undefined);
    expect(store.load(URL_A).status).toBe('loading');
  });

  it('GIVEN a loading URL WHEN the bytes arrive THEN its status is loaded', async () => {
    const fetch = deferredFetcher();
    const settled = vi.fn();
    const store = new FontStore(fetch.fetcher, settled);
    store.load(URL_A);
    fetch.resolve(vendoredKalamBytes());
    await vi.waitFor(() => expect(settled).toHaveBeenCalled());
    expect(store.load(URL_A).status).toBe('loaded');
  });

  it('GIVEN a loading URL WHEN the fetch fails THEN its status is error', async () => {
    const fetch = deferredFetcher();
    const settled = vi.fn();
    const store = new FontStore(fetch.fetcher, settled);
    store.load(URL_A);
    fetch.reject(new Error('offline'));
    await vi.waitFor(() => expect(settled).toHaveBeenCalled());
    expect(store.load(URL_A).status).toBe('error');
  });

  it('GIVEN a loading URL WHEN the bytes are not a font THEN its status is error', async () => {
    const fetch = deferredFetcher();
    const settled = vi.fn();
    const store = new FontStore(fetch.fetcher, settled);
    store.load(URL_A);
    fetch.resolve(new ArrayBuffer(16));
    await vi.waitFor(() => expect(settled).toHaveBeenCalled());
    expect(store.load(URL_A).status).toBe('error');
  });

  it('GIVEN a URL loaded twice WHEN counting fetches THEN it was fetched once', () => {
    const fetch = deferredFetcher();
    const store = new FontStore(fetch.fetcher, () => undefined);
    store.load(URL_A);
    store.load(URL_A);
    expect(fetch.calls).toEqual([URL_A]);
  });
});
