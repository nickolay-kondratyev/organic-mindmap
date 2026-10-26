import { useState } from 'react';
import { PanelSection } from '../PanelSection';

const MARKDOWN_INPUT_ID = 'paste-markdown';
const MARKDOWN_ROWS = 6;

interface PasteMarkdownControlsProps {
  /** Shows the headings of `markdown` as the map (spec D7). */
  readonly onShowHeadings: (markdown: string) => void;
}

/** Paste a note, see its headings as the map, the way the Obsidian heading map will draw it. */
export function PasteMarkdownControls({ onShowHeadings }: PasteMarkdownControlsProps) {
  const [markdown, setMarkdown] = useState('');
  return (
    <PanelSection title="Paste Markdown">
      <div className="field">
        <label htmlFor={MARKDOWN_INPUT_ID}>Markdown note</label>
        <textarea
          id={MARKDOWN_INPUT_ID}
          rows={MARKDOWN_ROWS}
          value={markdown}
          placeholder={'# Note title\n## Section\n### Sub-section'}
          spellCheck={false}
          onChange={(event) => setMarkdown(event.target.value)}
        />
        <p className="field__hint">
          Each heading becomes a node under the nearest heading above it with a lower level. The root is the single H1,
          else "Pasted note". For document order, set Layout &gt; First-level side order to clockwise. "Reset map" brings
          back the example.
        </p>
      </div>
      <div className="button-row">
        <button type="button" className="button" onClick={() => onShowHeadings(markdown)} disabled={markdown.trim() === ''}>
          Show headings as map
        </button>
      </div>
    </PanelSection>
  );
}
