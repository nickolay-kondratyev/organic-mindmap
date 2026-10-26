/** Produces a candidate block id. Injected so tests get predictable ids. */
export type BlockIdSource = () => string;

/** Same shape as the ids Obsidian generates ("Copy block link"): 6 lowercase letters or digits. */
export const GENERATED_BLOCK_ID_LENGTH = 6;
const BLOCK_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
/** A random 6-character id collides with a few hundred taken ids almost never; this only stops a broken source. */
const MAX_ID_ATTEMPTS = 1000;

export const randomBlockId: BlockIdSource = () =>
  // Modulo bias (256 % 36) is irrelevant for ids that only need to be unique within one note.
  Array.from(crypto.getRandomValues(new Uint8Array(GENERATED_BLOCK_ID_LENGTH)), (byte) =>
    BLOCK_ID_ALPHABET.charAt(byte % BLOCK_ID_ALPHABET.length),
  ).join('');

/** A new id from `source` that is not in `taken`; adds it to `taken`. */
export function claimUniqueBlockId(source: BlockIdSource, taken: Set<string>): string {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const id = source();
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
  throw new Error(`No unused block id after attempts=[${MAX_ID_ATTEMPTS}]`);
}
