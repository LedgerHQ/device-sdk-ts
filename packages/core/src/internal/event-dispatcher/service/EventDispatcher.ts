import { Observable } from "rxjs";

export interface EventDispatcher<T extends Record<string, unknown>> {
  listen(): Observable<T>;
  dispatch(event: Partial<T>): void;
  get(): T;
  close(): void;
}
