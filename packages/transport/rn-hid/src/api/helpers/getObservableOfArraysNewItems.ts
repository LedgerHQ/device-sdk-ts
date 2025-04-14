import { distinct, mergeMap, type Observable } from "rxjs";

/**
 * Returns an Observable that emits each unique item from arrays emitted by the source Observable.
 *
 * This function flattens the arrays emitted by the source Observable and uses the provided keySelector
 * to determine uniqueness. Each item is emitted only once, even if it appears in multiple arrays.
 *
 * @template T - The type of items in the arrays.
 * @template K - The type of the unique key extracted from each item.
 * @param observable - An Observable that emits arrays of items.
 * @param keySelector - A function that extracts a unique key from an item.
 * @returns An Observable emitting each unique item exactly once.
 */
export function getObservableOfArraysNewItems<T, K>(
  observable: Observable<Array<T>>,
  keySelector: (item: T) => K,
): Observable<T> {
  return observable.pipe(
    mergeMap((items) => items),
    distinct(keySelector),
  );
}
