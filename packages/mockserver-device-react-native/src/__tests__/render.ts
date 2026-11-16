import { act, type ReactElement } from "react";
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** What a test needs from a rendered tree, found by the elements' testID. */
export interface Rendered {
  renderer: ReactTestRenderer;
  rerender(element: ReactElement): void;
  unmount(): void;
  /** Throws when the element is not there. */
  byTestId(testID: string): ReactTestInstance;
  queryByTestId(testID: string): ReactTestInstance | null;
  /** The host elements of a React Native component, like "Image". */
  allByType(type: string): ReactTestInstance[];
  text(node?: ReactTestInstance): string;
}

const isHost = (node: ReactTestInstance) => typeof node.type === "string";

export const render = (element: ReactElement): Rendered => {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });

  const allByType = (type: string) =>
    renderer.root.findAll((node) => (node.type as unknown) === type);

  const queryByTestId = (testID: string) =>
    renderer.root.findAll(
      (node) => isHost(node) && node.props["testID"] === testID,
    )[0] ?? null;

  const text = (node: ReactTestInstance = renderer.root): string =>
    node.children
      .map((child) => (typeof child === "string" ? child : text(child)))
      .join("");

  return {
    renderer,
    rerender: (next) => act(() => renderer.update(next)),
    unmount: () => act(() => renderer.unmount()),
    byTestId: (testID) => {
      const node = queryByTestId(testID);
      if (!node) throw new Error(`No element with testID "${testID}"`);
      return node;
    },
    queryByTestId,
    allByType,
    text,
  };
};

/** Runs the timers due in `ms`, and the promises they settle. */
export const wait = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

/** Calls an element's handler, outside of React's update batching. */
export const invoke = (
  node: ReactTestInstance,
  handler: string,
  event: unknown = {},
): unknown => (node.props[handler] as (event: unknown) => unknown)(event);

/** Calls an element's handler the way React Native would. */
export const fire = (
  node: ReactTestInstance,
  handler: string,
  event: unknown = {},
) =>
  act(() => {
    invoke(node, handler, event);
  });
