/** The first `[[link]]` or `![[embed]]` in a line. [regex]: 1 the link target (before any `|alias`). */
const FIRST_WIKI_LINK = /!?\[\[([^\]|]*)(?:\|[^\]]*)?\]\]/;

/**
 * What a click on the node opens: the target of the first `[[link]]` in the item text (`Note`, `Note#Heading`,
 * `Note#^block`, as Obsidian's `openLinkText` takes it), or `null` for an item without a link.
 */
export function firstLinkTarget(rawText: string): string | null {
  const target = FIRST_WIKI_LINK.exec(rawText)?.[1]?.trim();
  return target === undefined || target === '' ? null : target;
}
