import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The same Kalam TTF the default config fetches from Fontsource, vendored so tests never hit the network. */
export const VENDORED_KALAM_TTF_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../assets/fonts/kalam/latin-400-normal.ttf',
);

export function vendoredKalamBytes(): ArrayBuffer {
  const buffer = readFileSync(VENDORED_KALAM_TTF_PATH);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}
