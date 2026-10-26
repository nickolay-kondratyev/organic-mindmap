import type { ReactNode } from 'react';

/** One titled block of the runner side panel; `actions` sit right of the title (e.g. a reset button). */
export function PanelSection({ title, actions, children }: { readonly title: string; readonly actions?: ReactNode; readonly children: ReactNode }) {
  return (
    <section className="panel-section" aria-label={title}>
      <header className="panel-section__header">
        <h2 className="panel-section__title">{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}
