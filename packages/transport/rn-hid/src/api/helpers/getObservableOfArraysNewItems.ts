import { map, mergeMap, type Observable, pairwise, startWith } from "rxjs";

/**
 * Transforms an Observable of arrays into an Observable that emits only new items.
 *
 * @param observable - The source Observable emitting arrays of items.
 * @param compare - A function to compare two items for equality.
 * @returns An Observable emitting items that are new compared to the previous array.
 */

export function getObservableOfArraysNewItems<T>(
  observable: Observable<Array<T>>,
  compare: (a: T, b: T) => boolean,
): Observable<T> {
  return observable.pipe(
    startWith([]),
    pairwise(),
    map(([prev, current]) => {
      return current.filter(
        (currentItem) =>
          !prev.some((prevItem) => compare(prevItem, currentItem)),
      );
    }),
    mergeMap((newItems) => newItems),
  );
}
