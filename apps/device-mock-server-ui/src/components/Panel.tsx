import { type ReactNode } from "react";

interface PanelProps {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}

export function Panel({ title, description, action, children }: PanelProps) {
  return (
    <section className="bg-base border-muted flex flex-col gap-16 rounded-lg border p-24">
      <header className="flex flex-wrap items-start justify-between gap-12">
        <div className="flex flex-col gap-2">
          <h2 className="heading-4 text-base">{title}</h2>
          <p className="body-3 text-muted">{description}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
