import { BehaviorSubject, Observable } from "rxjs";

import { EventDispatcher } from "./EventDispatcher";

export class DefaultEventDispatcher<T extends Record<string, unknown>>
  implements EventDispatcher<T>
{
  private obs: BehaviorSubject<T>;

  constructor(e: T) {
    this.obs = new BehaviorSubject<T>(e);
  }

  get(): T {
    return this.obs.getValue();
  }

  listen(): Observable<T> {
    return this.obs.asObservable();
  }

  dispatch(event: Partial<T>): void {
    const currentState = this.get();
    this.obs.next({ ...currentState, ...event });
  }

  close(): void {
    this.obs.complete();
  }
}
