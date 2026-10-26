import type { EditStatus } from 'natural-mindmap';
import { PanelSection } from '../PanelSection';
import { describeDelay, type HostSimulationSettings } from './demoHost';

const MAX_DELAY_MS = 5000;
const DELAY_STEP_MS = 250;
const DELAY_INPUT_ID = 'host-delay';
const REJECT_INPUT_ID = 'host-reject';

const STATUS_TEXT: Readonly<Record<EditStatus['kind'], string>> = {
  idle: 'Ready for the next change.',
  pending: 'Waiting for the host to save the change…',
  rejected: 'The host rejected the last change; the reason is shown on the map.',
};

interface HostSimulationControlsProps {
  readonly settings: HostSimulationSettings;
  readonly onChange: (settings: HostSimulationSettings) => void;
  readonly editStatus: EditStatus;
}

/** Makes the in-memory host slow or refusing (spec D5), so pending and rejected edits can be seen. */
export function HostSimulationControls({ settings, onChange, editStatus }: HostSimulationControlsProps) {
  return (
    <PanelSection title="Host simulation">
      <div className="field">
        <div className="field__label-row">
          <label htmlFor={DELAY_INPUT_ID}>Answer delay</label>
          <output htmlFor={DELAY_INPUT_ID} className="field__value">{describeDelay(settings.delayMs)}</output>
        </div>
        <input
          id={DELAY_INPUT_ID}
          type="range"
          min={0}
          max={MAX_DELAY_MS}
          step={DELAY_STEP_MS}
          value={settings.delayMs}
          onChange={(event) => onChange({ ...settings, delayMs: Number(event.target.value) })}
        />
        <p className="field__hint">How long the host takes to save a change.</p>
      </div>
      <div className="field field--inline">
        <input
          id={REJECT_INPUT_ID}
          type="checkbox"
          checked={settings.rejectEdits}
          onChange={(event) => onChange({ ...settings, rejectEdits: event.target.checked })}
        />
        <label htmlFor={REJECT_INPUT_ID}>Reject every change</label>
      </div>
      <p className="edit-status" role="status" data-testid="edit-status" data-kind={editStatus.kind}>
        {editStatus.kind === 'pending' && <span className="spinner" aria-hidden="true" />}
        {STATUS_TEXT[editStatus.kind]}
      </p>
    </PanelSection>
  );
}
