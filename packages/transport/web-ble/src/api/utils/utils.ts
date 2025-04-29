import { type DataViewEvent } from "@api/transport/BleDeviceConnection";

export function isDataViewEvent(e: Event): e is DataViewEvent {
  const target = e.target as EventTarget & { value?: unknown };
  return target?.value instanceof DataView;
}
