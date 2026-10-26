import type { KeyboardEvent } from 'react';
import { formatNumber, type SettingField } from './settingsModel';

interface SettingControlProps {
  readonly field: SettingField;
  readonly value: unknown;
  readonly changed: boolean;
  readonly onChange: (value: unknown) => void;
}

/** One live control for one config leaf; which input depends on the field kind. */
export function SettingControl({ field, value, changed, onChange }: SettingControlProps) {
  const label = (
    <label htmlFor={field.id} className={changed ? 'field__label field__label--changed' : 'field__label'}>
      {field.label}
    </label>
  );
  const testId = `setting:${field.id}`;
  switch (field.kind) {
    case 'number': {
      const { min, max, step, hint } = field.range;
      return (
        <div className="field">
          <div className="field__label-row">
            {label}
            <output htmlFor={field.id} className="field__value">{formatNumber(value as number, step)}</output>
          </div>
          <input id={field.id} data-testid={testId} type="range" min={min} max={max} step={step} value={value as number} onChange={(event) => onChange(Number(event.target.value))} />
          {hint !== undefined && <p className="field__hint">{hint}</p>}
        </div>
      );
    }
    case 'color':
      return (
        <div className="field field--inline">
          <input id={field.id} data-testid={testId} type="color" value={value as string} onChange={(event) => onChange(event.target.value)} />
          {label}
          <code className="field__value">{value as string}</code>
        </div>
      );
    case 'toggle':
      return (
        <div className="field field--inline">
          <input id={field.id} data-testid={testId} type="checkbox" checked={value as boolean} onChange={(event) => onChange(event.target.checked)} />
          {label}
        </div>
      );
    case 'choice':
      return (
        <div className="field">
          {label}
          <select id={field.id} data-testid={testId} value={value as string} onChange={(event) => onChange(event.target.value)}>
            {field.options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    case 'text':
      return (
        <div className="field">
          {label}
          {/* Commits on Enter or leaving the field, not per keystroke: a half-typed font URL would trigger a load. Keyed by
              value so "Reset settings" refreshes the uncontrolled input. */}
          <input
            key={value as string}
            id={field.id}
            data-testid={testId}
            type="text"
            spellCheck={false}
            defaultValue={value as string}
            onBlur={(event) => commitIfChanged(event.target.value, value, onChange)}
            onKeyDown={(event) => commitOnEnter(event, value, onChange)}
          />
        </div>
      );
  }
}

function commitOnEnter(event: KeyboardEvent<HTMLInputElement>, value: unknown, onChange: (value: unknown) => void): void {
  if (event.key === 'Enter') commitIfChanged(event.currentTarget.value, value, onChange);
}

function commitIfChanged(typed: string, value: unknown, onChange: (value: unknown) => void): void {
  if (typed !== value) onChange(typed);
}
