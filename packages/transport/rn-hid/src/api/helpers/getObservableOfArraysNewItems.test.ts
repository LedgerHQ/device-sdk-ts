import { from } from "rxjs";

import { getObservableOfArraysNewItems } from "./getObservableOfArraysNewItems";

type Item = { id: number };

describe("getObservableOfArraysNewItems", () => {
  it("transforms an Observable of arrays into an Observable that emits only new items", (done) => {
    const observable = from([
      [{ id: 1 }, { id: 2 }], // new items: [{ id: 1 }, { id: 2 }]
      [{ id: 1 }, { id: 2 }, { id: 3 }], // new items: [{ id: 3 }]
      [{ id: 1 }, { id: 2 }, { id: 3 }], // no new items: []
      [{ id: 1 }, { id: 2 }, { id: 4 }], // new items: [{ id: 4 }]
      [], // no new items: []
      [{ id: 1 }], // new items: [{ id: 1 }]
    ]);
    const compare = (a: Item, b: Item) => a.id === b.id;
    const result = getObservableOfArraysNewItems(observable, compare);
    const expectedValues = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 1 },
    ];

    let index = 0;
    result.subscribe({
      next: (value) => {
        try {
          expect(value).toEqual(expectedValues[index]);
          index += 1;
        } catch (e) {
          done(e);
        }
      },
      complete: () => {
        done();
      },
    });
  });
});
