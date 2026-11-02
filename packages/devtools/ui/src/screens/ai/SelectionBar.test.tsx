import React, { act } from "react";
import { createRoot } from "react-dom/client";

import { AiAvailable, SelectionBar } from "./SelectionBar";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const renderBar = (aiAvailable: boolean) => {
  const container = document.createElement("div");
  const onExplain = vi.fn();
  act(() =>
    createRoot(container).render(
      React.createElement(
        AiAvailable.Provider,
        { value: aiAvailable },
        React.createElement(SelectionBar, {
          label: "1 log selected",
          detail: "",
          onClear: () => {},
          onExplain,
        }),
      ),
    ),
  );
  const explain = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Explain with AI"),
  )!;
  return { explain, onExplain };
};

describe("SelectionBar", () => {
  it("explains the selection when the host runs Claude", () => {
    const { explain, onExplain } = renderBar(true);
    act(() => explain.click());
    expect(explain.disabled).toBe(false);
    expect(onExplain).toHaveBeenCalledTimes(1);
  });

  it("disables Explain with AI when the host cannot run Claude", () => {
    const { explain, onExplain } = renderBar(false);
    act(() => explain.click());
    expect(explain.disabled).toBe(true);
    expect(onExplain).not.toHaveBeenCalled();
  });
});
