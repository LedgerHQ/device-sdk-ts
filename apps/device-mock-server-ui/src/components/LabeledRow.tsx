import { type ReactNode } from "react";

export function LabeledRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <span className="body-4 text-muted w-128 shrink-0">{label}</span>
      <div className="flex min-w-0 items-center gap-8">{children}</div>
    </div>
  );
}
