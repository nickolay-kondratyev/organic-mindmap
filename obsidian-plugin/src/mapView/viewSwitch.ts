/** Obsidian view type of the map; `.md` files flagged as mindmap notes open with it instead of `markdown`. */
export const MINDMAP_VIEW_TYPE = 'organic-mindmap';
/** Obsidian's own Markdown editor view type. */
export const MARKDOWN_VIEW_TYPE = 'markdown';

/**
 * Remembers, per leaf, the note the user chose to see as Markdown (via "Open as Markdown"), so re-opening that
 * note in that leaf (e.g. switching editor modes, going back in history) does not bounce it back to the map.
 * Keyed by the leaf object so no leaf id is needed; a leaf that goes away takes its choice with it.
 */
export class MarkdownChoices<Leaf extends object> {
  private readonly pathByLeaf = new WeakMap<Leaf, string>();

  chooseMarkdown(leaf: Leaf, path: string): void {
    this.pathByLeaf.set(leaf, path);
  }

  forget(leaf: Leaf): void {
    this.pathByLeaf.delete(leaf);
  }

  isMarkdownChosen(leaf: Leaf, path: string): boolean {
    return this.pathByLeaf.get(leaf) === path;
  }
}

export interface ViewTypeDecisionInput {
  /** The view type the leaf was asked to show. */
  readonly requestedType: string;
  /** Whether the file's frontmatter flags it as a mindmap note. */
  readonly isMindmapNote: boolean;
  /** Whether the user chose Markdown for this note in this leaf. */
  readonly markdownChosen: boolean;
}

/**
 * Which view type a leaf should really show: a mindmap note asked to open as Markdown opens as a map, unless the
 * user chose Markdown for it. Every other request is left alone (explicit map requests included).
 */
export function resolveViewType(input: ViewTypeDecisionInput): string {
  if (input.requestedType !== MARKDOWN_VIEW_TYPE) return input.requestedType;
  if (!input.isMindmapNote || input.markdownChosen) return MARKDOWN_VIEW_TYPE;
  return MINDMAP_VIEW_TYPE;
}
