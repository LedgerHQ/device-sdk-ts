import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";

import { useDragSelect } from "./useDragSelect";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const renderDrag = (initialRows: string[]) => {
  let rows = initialRows;
  let drag!: ReturnType<typeof useDragSelect<string>>;
  let selected = new Set<string>();
  const onDragEnd = vi.fn();
  const Probe = () => {
    const [current, setCurrent] = useState<Set<string>>(new Set());
    selected = current;
    drag = useDragSelect(
      (index) => rows[index],
      (key) => rows.indexOf(key),
      current,
      setCurrent,
      onDragEnd,
    );
    return null;
  };
  const root = createRoot(document.createElement("div"));
  act(() => root.render(React.createElement(Probe)));
  const leftButton = { button: 0, shiftKey: false } as React.MouseEvent;
  return {
    selected: () => [...selected].sort(),
    setRows: (next: string[]) => {
      rows = next;
    },
    down: (index: number) => act(() => drag.onRowMouseDown(index, leftButton)),
    enter: (index: number) => act(() => drag.onRowMouseEnter(index)),
    up: () => act(() => window.dispatchEvent(new MouseEvent("mouseup"))),
    onDragEnd,
  };
};

describe("useDragSelect", () => {
  it("selects the rows between the press and the row the mouse is over", () => {
    const drag = renderDrag(["a", "b", "c", "d"]);
    drag.down(1);
    drag.enter(3);
    expect(drag.selected()).toEqual(["b", "c", "d"]);
  });

  it("keeps the range on the pressed row when new rows arrive during the drag", () => {
    const drag = renderDrag(["a", "b", "c"]);
    drag.down(1);
    drag.setRows(["new", "a", "b", "c"]);
    drag.enter(3);
    expect(drag.selected()).toEqual(["b", "c"]);
  });

  it("reports the row the drag ended on", () => {
    const drag = renderDrag(["a", "b", "c"]);
    drag.down(0);
    drag.enter(2);
    drag.up();
    expect(drag.onDragEnd).toHaveBeenCalledWith("c");
  });

  it("stops extending once the pressed row is gone", () => {
    const drag = renderDrag(["a", "b", "c"]);
    drag.down(0);
    drag.setRows(["b", "c"]);
    drag.enter(1);
    expect(drag.selected()).toEqual([]);
  });
});
