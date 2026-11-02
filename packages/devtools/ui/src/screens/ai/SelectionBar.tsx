import React, { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { SparksFill } from "@ledgerhq/lumen-ui-react/symbols";

/** The dashboard's footer, where the views' selection bars show. */
export const SelectionBarSlot = createContext<HTMLElement | null>(null);

/** Shown while rows are selected, to send them to the AI panel. */
export const SelectionBar: React.FC<{
  label: string;
  detail: string;
  onClear: () => void;
  onExplain: () => void;
}> = ({ label, detail, onClear, onExplain }) => {
  const slot = useContext(SelectionBarSlot);
  const bar = (
    <div className="flex shrink-0 items-center gap-10 border-t border-muted-subtle bg-surface px-12 py-8">
      <span className="body-3-semi-bold">{label}</span>
      <span className="truncate body-4 text-muted">{detail}</span>
      <span className="flex-1" />
      <button
        type="button"
        onClick={onClear}
        className="cursor-pointer rounded-sm bg-muted-transparent px-12 py-6 body-3-semi-bold hover:bg-muted-transparent-hover"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={onExplain}
        className="flex cursor-pointer items-center gap-6 rounded-sm bg-accent px-12 py-6 body-3-semi-bold text-on-accent hover:bg-accent-hover"
      >
        <SparksFill size={16} />
        Explain with AI
      </button>
    </div>
  );
  return slot ? createPortal(bar, slot) : bar;
};
