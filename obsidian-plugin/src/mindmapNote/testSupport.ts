import type { BlockIdSource } from './blockId';
import type { MindmapNote } from './mindmapNote';
import { readMindmapNote } from './readMindmapNote';

/** Note text from lines, ending with a line break like files Obsidian saves. */
export function noteText(...lines: string[]): string {
  return `${lines.join('\n')}\n`;
}

/** Predictable generated ids: `gen1`, `gen2`, ... */
export function sequentialIds(): BlockIdSource {
  let next = 0;
  return () => `gen${++next}`;
}

/** Reads a note that must be readable; generated ids are `gen1`, `gen2`, ... */
export function readNote(text: string): MindmapNote {
  const result = readMindmapNote(text, sequentialIds());
  if (result.kind !== 'read') throw new Error(`Expected a readable note, got problem=[${result.problem}]`);
  return result.note;
}

/** The problem reading `text`, or `null` when it reads. */
export function readProblem(text: string): string | null {
  const result = readMindmapNote(text, sequentialIds());
  return result.kind === 'problem' ? result.problem : null;
}
