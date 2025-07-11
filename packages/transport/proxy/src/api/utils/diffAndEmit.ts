export type DescriptorEvent<Dev> =
  | { type: "add"; descriptor: Dev }
  | { type: "remove"; descriptor: string };

/**
 * compares a new list of devices against what was previously seen,
 * emits add/remove events, and updates the `seen` map in place.
 */
export const diffAndEmit = <Dev extends { id: string }>(
  rawList: Dev[],
  seen: Map<string, Dev>,
  emit: (ev: DescriptorEvent<Dev>) => void,
) => {
  // incoming IDs
  const newIds = new Set(rawList.map((d) => d.id));
  // new IDs that are not in the seen map
  const added = rawList.filter((d) => !seen.has(d.id));
  // disappeared IDs
  const removed = Array.from(seen.keys()).filter((id) => !newIds.has(id));

  // add events
  added.forEach((dev) => {
    seen.set(dev.id, dev);
    emit({ type: "add", descriptor: dev });
  });

  // remove events
  removed.forEach((id) => {
    seen.delete(id);
    emit({ type: "remove", descriptor: id });
  });
};
