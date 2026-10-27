import type { FontConfig, MindmapConfig } from '../config/config';
import type { MindmapExtensions } from '../extensions';
import type { Branch } from '../geometry/branchPath';
import type { NodeId } from '../model/node';
import type { NodeBox } from '../shape/nodeShape';
import { GlyphRun } from '../text/glyphRun';
import { layoutBranchLabel, layoutNodeLabel, type LabelLayout } from '../text/labelLayout';
import { ELLIPSIS, fitNodeText, glyphRunMeasure, truncatedShapedText } from '../text/nodeTextFit';
import { paintLabel, type LabelInk } from '../text/labelPainter';
import type { LabelFonts } from '../text/labelFontLoader';
import type { LoadedFont, ShapedText } from '../text/loadedFont';
import { rimToRimSpan } from '../text/rimSpan';
import { paintSystemTextLabel } from '../text/systemTextLabel';
import type { Scene } from './scene';

/** Share of the node width a straight label may use, keeping glyphs clear of the curved rim. */
const NODE_LABEL_WIDTH_FRACTION = 0.8;

/** System-font fallback for labels the glyph font cannot cover (spec R17 exception; see docs "Labels"). */
export interface LabelFallback {
  /** CSS `font-family` list starting with the node label font (`CssFontFaces.familyFor`), then system fonts. */
  readonly nodeFontFamily: string;
}

/**
 * Draws node labels (spec R2, R3) and the same labels along their incoming branches (spec R12-R16). A label with
 * characters its font lacks (`LoadedFont.coversText`) is not drawn on its branch and is drawn on its node with
 * system-font fallback, so every character shows and no empty boxes appear.
 */
export function drawLabels(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  config: MindmapConfig,
  extensions: MindmapExtensions,
  fonts: LabelFonts,
  fallback: LabelFallback,
): void {
  if (fonts.branch !== null) {
    for (const branch of scene.branches) drawBranchLabel(ctx, scene, config, extensions, fonts.branch, branch);
  }
  if (fonts.node !== null) {
    for (const node of scene.tree.nodes) {
      const box = boxOf(scene, node.id);
      if (box === null) continue;
      drawNodeLabel(ctx, config, fonts.node, fallback, node.text, box, nodeLabelInk(config, node.parentId === null, node.link === true));
    }
  }
}

function drawNodeLabel(
  ctx: CanvasRenderingContext2D,
  config: MindmapConfig,
  font: LoadedFont,
  fallback: LabelFallback,
  text: string,
  box: NodeBox,
  ink: LabelInk,
): void {
  const style = config.text.node;
  const maxWidthPx = box.size.width * NODE_LABEL_WIDTH_FRACTION;
  if (!font.coversText(text)) {
    const systemStyle = { family: fallback.nodeFontFamily, sizePx: style.sizePx, letterSpacingEm: style.letterSpacingEm };
    paintSystemTextLabel(ctx, text, box.center, maxWidthPx, systemStyle, ink, config.text.nodeFit);
    return;
  }
  const full = font.shape(text);
  const ellipsis = font.shape(ELLIPSIS);
  const runOf = (shaped: ShapedText): GlyphRun => new GlyphRun(shaped.advancesEm, style.stretch);
  const fit = fitNodeText(glyphRunMeasure(runOf(full), runOf(ellipsis), style.letterSpacingEm), maxWidthPx, style.sizePx, config.text.nodeFit);
  const shaped = fit.truncated ? truncatedShapedText(full, ellipsis, fit.keptCount) : full;
  const run = runOf(shaped);
  const layout = layoutNodeLabel(box.center, run, { ...style, sizePx: fit.sizePx });
  paintLabel(ctx, font, shaped, run, layout, ink);
}

/**
 * The root label uses the root text color and is always bold (spec R3). A link label (`MindmapNode.link`) is
 * underlined in `theme.color.link`, the root's too.
 */
export function nodeLabelInk(config: MindmapConfig, isRoot: boolean, isLink: boolean): LabelInk {
  const style = config.text.node;
  if (!isRoot) return inkOf(style, config.theme.color.nodeText, isLink, config);
  return { ...inkOf(style, config.theme.color.root.text, isLink, config), bold: true };
}

/** Branch labels use the branch text color; a link label is underlined in `theme.color.link`. */
export function branchLabelInk(config: MindmapConfig, isLink: boolean): LabelInk {
  return inkOf(config.text.branch, config.theme.color.branchText, isLink, config);
}

function drawBranchLabel(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  config: MindmapConfig,
  extensions: MindmapExtensions,
  font: LoadedFont,
  branch: Branch,
): void {
  const style = config.text.branch;
  const child = scene.tree.nodeById(branch.childId);
  const text = child.text;
  if (!font.coversText(text)) return;
  const shaped = font.shape(text);
  const run = new GlyphRun(shaped.advancesEm, style.stretch);
  const layout = layoutSceneBranchLabel(scene, config, extensions, run, branch);
  if (layout === null) return;
  paintLabel(ctx, font, shaped, run, layout, branchLabelInk(config, child.link === true));
}

/** Lays out the child's label along `branch` between the two node rims; `null` when a node has no box. */
export function layoutSceneBranchLabel(
  scene: Scene,
  config: MindmapConfig,
  extensions: MindmapExtensions,
  run: GlyphRun,
  branch: Branch,
): LabelLayout | null {
  const parent = boxOf(scene, branch.parentId);
  const child = boxOf(scene, branch.childId);
  if (parent === null || child === null) return null;
  const span = rimToRimSpan(branch.path, parent, child, extensions.nodeShape);
  return layoutBranchLabel(branch.path, span, run, config.text.branch, config.text.branchFit);
}

function inkOf(style: FontConfig, textColor: string, isLink: boolean, config: MindmapConfig): LabelInk {
  return {
    fill: isLink ? config.theme.color.link : textColor,
    underline: isLink,
    outline: config.theme.color.textOutline,
    outlineWidthPx: style.outlineWidthPx,
    bold: style.bold,
    stretch: style.stretch,
    slant: style.slant,
  };
}

function boxOf(scene: Scene, id: NodeId): NodeBox | null {
  const center = scene.positions.get(id);
  const size = scene.sizes.get(id);
  return center === undefined || size === undefined ? null : { center, size };
}
