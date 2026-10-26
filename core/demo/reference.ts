import { mountMindmap, REFERENCE_DATA } from 'organic-mindmap';

/**
 * Canvas-only acceptance page (spec Q3, §8): the reference data with zero config and nothing else on screen,
 * so the Playwright screenshot baseline cannot be broken by demo chrome such as the settings panel.
 * Font status goes on <body data-font-status> so the test knows when the labels have been painted.
 */
const canvas = document.querySelector('canvas');
if (canvas === null) throw new Error('Reference page canvas is missing');
mountMindmap(canvas, {
  data: REFERENCE_DATA,
  onFontStatusChange: (status) => {
    document.body.dataset['fontStatus'] = status.node === 'loaded' && status.branch === 'loaded' ? 'loaded' : status.node;
  },
});
