import React from "react";
import { cn } from "@ledgerhq/lumen-design-core/cn";
import { ChevronRight } from "@ledgerhq/lumen-ui-react/symbols";

export const ClickableListItem: React.FC<{
  title: string;
  description: string;
  onClick(): void;
  icon?: React.ReactNode;
  className?: string;
}> = ({ title, description, onClick, icon, className }) => {
  return (
    <div
      className={cn(
        "flex cursor-pointer flex-row items-center gap-8 rounded-md bg-surface p-16 hover:bg-surface-hover",
        className,
      )}
      onClick={onClick}
      data-testid={`CTA_command-${title}`}
    >
      {icon}
      <div className="flex flex-1 flex-col gap-8">
        <span className="body-1-semi-bold text-base">{title}</span>
        <span className="body-2 text-muted">{description}</span>
      </div>
      <ChevronRight size={20} className="text-muted" />
    </div>
  );
};
