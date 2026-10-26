/** `[[target]]`, `[[target|alias]]`, also embedded (`![[...]]`). [regex]: 1 target, 2 optional alias. */
const WIKI_LINK = /!?\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g;
/** How Obsidian shows `[[Note#Heading]]`: `Note > Heading`. */
const SUBPATH_SEPARATOR = ' > ';

/** The item text as shown on the map: each `[[link]]` becomes its display text (alias, else the link target). */
export function displayLabel(rawText: string): string {
  return rawText.replace(WIKI_LINK, (_link, target: string, alias: string | undefined) =>
    alias !== undefined && alias !== '' ? alias : targetLabel(target),
  );
}

function targetLabel(target: string): string {
  return target
    .split('#')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join(SUBPATH_SEPARATOR);
}
