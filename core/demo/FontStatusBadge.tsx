import type { CSSProperties } from 'react';
import type { LabelFontStatus } from 'natural-mindmap';

type OverallStatus = 'loading' | 'loaded' | 'error';

const MESSAGE: Record<OverallStatus, string | null> = {
  loading: 'Loading fonts…',
  loaded: null,
  error: 'Fonts could not be loaded, so labels are hidden. Check the font URL in settings.',
};

const BADGE_STYLE: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  padding: '6px 10px',
  borderRadius: 6,
  background: 'rgba(255, 255, 255, 0.1)',
  color: '#e6e8ef',
  font: '14px system-ui, sans-serif',
};

/** Shows the library's font loading state (spec L6); `data-status` is what E2E tests read. */
export function FontStatusBadge({ status }: { readonly status: LabelFontStatus | null }) {
  const overall = overallStatus(status);
  const message = MESSAGE[overall];
  return (
    <div data-testid="font-status" data-status={overall} role="status" style={message === null ? { display: 'none' } : BADGE_STYLE}>
      {message}
    </div>
  );
}

function overallStatus(status: LabelFontStatus | null): OverallStatus {
  if (status === null) return 'loading';
  if (status.node === 'error' || status.branch === 'error') return 'error';
  if (status.node === 'loading' || status.branch === 'loading') return 'loading';
  return 'loaded';
}
