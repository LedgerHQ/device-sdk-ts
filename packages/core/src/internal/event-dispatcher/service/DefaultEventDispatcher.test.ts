import { Observable } from "rxjs";

import { DefaultEventDispatcher } from "./DefaultEventDispatcher";

describe("DefaultEventDispatcher", () => {
  it("should dispatch an event", () => {
    const dispatcher = new DefaultEventDispatcher({ a: 1 });
    dispatcher.dispatch({ a: 2 });
    expect(dispatcher.get()).toEqual({ a: 2 });
  });

  it("should listen to an event", () => {
    const dispatcher = new DefaultEventDispatcher({ a: 1 });
    const subscription = dispatcher.listen();
    expect(subscription).toBeInstanceOf(Observable);
  });

  it("should close the event dispatcher", () => {
    const dispatcher = new DefaultEventDispatcher({ a: 1 });
    dispatcher.close();
    expect(dispatcher.get()).toEqual({ a: 1 });
  });
});
