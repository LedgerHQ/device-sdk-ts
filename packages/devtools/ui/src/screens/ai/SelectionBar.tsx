import React, { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { SparksFill } from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "../../components/WithTooltip";

/** The dashboard's footer, where the views' selection bars show. */
export const SelectionBarSlot = createContext<HTMLElement | null>(null);

/**
 * Whether the view around it is on screen. Hidden views stay mounted, and their
 * bar would otherwise still show in the footer.
 */
export const SelectionBarVisible = createContext(true);

/** Whether the host can run Claude Code. Rozenite cannot yet. */
export const AiAvailable = createContext(true);

export const AI_UNAVAILABLE =
  "AI debugging is not available here yet. Use the DevTools desktop app.";

/** Shown while rows are selected, to send them to the AI panel. */
export const SelectionBar: React.FC<{
  label: string;
  detail: string;
  onClear: () => void;
  onExplain: () => void;
}> = ({ label, detail, onClear, onExplain }) => {
  const slot = useContext(SelectionBarSlot);
  const visible = useContext(SelectionBarVisible);
  const aiAvailable = useContext(AiAvailable);
  if (!visible) return null;
  const explain = (
    <button
      type="button"
      onClick={onExplain}
      disabled={!aiAvailable}
      className="flex cursor-pointer items-center gap-6 rounded-sm bg-accent px-12 py-6 body-3-semi-bold text-on-accent hover:bg-accent-hover disabled:pointer-events-none disabled:bg-muted-transparent disabled:text-disabled"
    >
      <SparksFill size={16} />
      Explain with AI
    </button>
  );
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
      {aiAvailable ? (
        explain
      ) : (
        <WithTooltip label={AI_UNAVAILABLE}>{explain}</WithTooltip>
      )}
    </div>
  );
  return slot ? createPortal(bar, slot) : bar;
};
