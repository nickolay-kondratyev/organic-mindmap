import { REFERENCE_DATA } from 'organic-mindmap';
import { statusMessage } from './statusMessage';

describe('statusMessage', () => {
  it('GIVEN a plugin version and the reference data WHEN formatting THEN names the version and node count', () => {
    expect(statusMessage('0.1.0', REFERENCE_DATA)).toBe(
      `Organic Mindmap 0.1.0: library ready (reference map has ${REFERENCE_DATA.length} nodes)`,
    );
  });
});
