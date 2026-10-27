import { LAYOUT_TYPES, SIDE_ORDERS, type MindmapConfig } from 'organic-mindmap';
import type { LeafPathOf } from './configPath';

/** Slider bounds for one numeric setting; `hint` is shown under the control when the label alone is not enough. */
export interface NumberRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly hint?: string;
}

export type NumberSettingPath = LeafPathOf<MindmapConfig, number>;

const FONT_SIZE_PX: NumberRange = { min: 8, max: 40, step: 1 };
const LETTER_SPACING_EM: NumberRange = { min: -0.1, max: 0.3, step: 0.005 };
const STRETCH: NumberRange = { min: 0.5, max: 1.5, step: 0.01, hint: 'Horizontal glyph scale; 1 is as designed.' };
const SLANT: NumberRange = { min: -0.5, max: 0.5, step: 0.01, hint: 'Positive leans right, negative leans left.' };
const OUTLINE_WIDTH_PX: NumberRange = { min: 0, max: 6, step: 0.1, hint: '0 draws no outline.' };

/**
 * Config defaults carry no bounds, so each numeric setting gets one here. A `Record` over every numeric config
 * path: adding a number to `MindmapConfig` does not compile until it has a slider range (spec D3).
 */
export const NUMBER_RANGES: Readonly<Record<NumberSettingPath, NumberRange>> = {
  'node.rootSize.width': { min: 60, max: 400, step: 1 },
  'node.rootSize.height': { min: 24, max: 160, step: 1 },
  'node.depthScale': {
    min: 0.4,
    max: 1.6,
    step: 0.01,
    hint: 'Size change per level. Below 1 children shrink (the default); above 1 they grow larger than their parent.',
  },
  'node.minScale': { min: 0.1, max: 1, step: 0.01, hint: 'Smallest node, as a fraction of the root size.' },
  'branch.rootWidth': { min: 4, max: 120, step: 1, hint: 'Thickness where a branch leaves the root.' },
  'branch.widthPerLevel': { min: 0.2, max: 1.2, step: 0.01, hint: 'Thickness change per level.' },
  'branch.taper': { min: 0, max: 1, step: 0.01, hint: 'End thickness as a fraction of the start; 0 ends in a point.' },
  'branch.asymmetry': { min: 0, max: 1, step: 0.01, hint: 'How much one edge bulges more than the other.' },
  'text.node.sizePx': FONT_SIZE_PX,
  'text.node.letterSpacingEm': LETTER_SPACING_EM,
  'text.node.stretch': STRETCH,
  'text.node.slant': SLANT,
  'text.node.outlineWidthPx': OUTLINE_WIDTH_PX,
  'text.branch.sizePx': FONT_SIZE_PX,
  'text.branch.letterSpacingEm': LETTER_SPACING_EM,
  'text.branch.stretch': STRETCH,
  'text.branch.slant': SLANT,
  'text.branch.outlineWidthPx': OUTLINE_WIDTH_PX,
  'text.branchFit.paddingPx': { min: 0, max: 40, step: 1, hint: 'Space kept free at each end of a branch label.' },
  'text.branchFit.minPaddingPx': { min: 0, max: 20, step: 1 },
  'text.branchFit.minLetterSpacingEm': { min: -0.2, max: 0, step: 0.005 },
  'text.branchFit.minFontScale': { min: 0.2, max: 1, step: 0.01, hint: 'How far a long branch label may shrink.' },
  'text.nodeFit.minFontScale': {
    min: 0,
    max: 1,
    step: 0.01,
    hint: 'How far a long node label may shrink before it is cut with "…"; 0 shrinks without limit.',
  },
  'layout.horizontalGap': { min: 20, max: 400, step: 1 },
  'layout.verticalGap': { min: 0, max: 160, step: 1 },
  'layout.bowOffset': { min: 0, max: 400, step: 1, hint: 'How far the top and bottom root branches bow outward.' },
  'layout.jitterAmplitude': { min: 0, max: 30, step: 0.5, hint: 'Hand-drawn wobble of node positions; 0 is exact.' },
  'layout.collisionPadding': { min: 0, max: 60, step: 1, hint: 'Minimum space kept between nodes.' },
};

/** String settings that are a fixed set of options rather than free text. */
export const STRING_CHOICES: Readonly<Partial<Record<LeafPathOf<MindmapConfig, string>, readonly string[]>>> = {
  'layout.type': LAYOUT_TYPES,
  'layout.sideOrder': SIDE_ORDERS,
};

/** Section titles for the top-level config keys, in the user's words. */
export const SECTION_TITLES: Readonly<Record<keyof MindmapConfig, string>> = {
  theme: 'Theme colors',
  node: 'Node size',
  branch: 'Branches',
  text: 'Text and fonts',
  layout: 'Layout',
  interaction: 'Interaction',
};

/** Field labels (by config key) the camelCase key cannot produce on its own. */
export const FIELD_LABELS: Readonly<Record<string, string>> = {
  url: 'Font file (TTF URL)',
  type: 'Layout type',
  sideOrder: 'First-level side order',
  nodeText: 'Node label',
  branchText: 'Branch label',
  textOutline: 'Label outline',
  link: 'Link label',
  text: 'Label',
  confirmReparent: 'Ask before making a node a child',
  allowAdd: 'Allow adding nodes (hover "+")',
  allowRename: 'Allow renaming (double-click)',
  allowDelete: 'Allow deleting (no delete control yet)',
  highlight: 'Highlighted node ring',
};

/** Group headings (by dotted config path) where the last key alone would be unclear. */
export const GROUP_TITLES: Readonly<Record<string, string>> = {
  'theme.color': 'Background and labels',
  'theme.color.root': 'Root node',
  'node.rootSize': 'Root node size',
  'text.node': 'Node labels',
  'text.branch': 'Branch labels',
  'text.branchFit': 'Fitting long branch labels',
  'text.nodeFit': 'Fitting long node labels',
};
