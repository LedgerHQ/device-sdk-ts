import { type Observable, Subject } from "rxjs";

import { type GetAppAndVersionResponse } from "@api/index";
import { type CommandResult } from "@api/types";

export enum SessionEvents {
  NEW_STATE = "NEW_STATE",
  REFRESH_NEEDED = "REFRESH_NEEDED",
  COMMAND_SUCCEEDED = "COMMAND_SUCCEEDED",
  DEVICE_STATE_UPDATE_BUSY = "DEVICE_STATE_UPDATE_BUSY",
  DEVICE_STATE_UPDATE_LOCKED = "DEVICE_STATE_UPDATE_LOCKED",
  DEVICE_STATE_UPDATE_CONNECTED = "DEVICE_STATE_UPDATE_CONNECTED",
  DEVICE_STATE_UPDATE_UNKNOWN = "DEVICE_STATE_UPDATE_UNKNOWN",
}

interface SessionEventPayloads {
  [SessionEvents.NEW_STATE]: undefined;
  [SessionEvents.REFRESH_NEEDED]: undefined;
  [SessionEvents.DEVICE_STATE_UPDATE_BUSY]: undefined;
  [SessionEvents.DEVICE_STATE_UPDATE_LOCKED]: undefined;
  [SessionEvents.DEVICE_STATE_UPDATE_CONNECTED]: undefined;
  [SessionEvents.DEVICE_STATE_UPDATE_UNKNOWN]: undefined;
  [SessionEvents.COMMAND_SUCCEEDED]: CommandResult<GetAppAndVersionResponse>;
}

export type NewEvent = {
  [K in SessionEvents]: SessionEventPayloads[K] extends undefined
    ? { eventName: K; eventData?: undefined }
    : { eventName: K; eventData: SessionEventPayloads[K] };
}[SessionEvents];

export class DeviceSessionEventDispatcher {
  private _eventEmitter: Subject<NewEvent> = new Subject();

  public listen(): Observable<NewEvent> {
    return this._eventEmitter.asObservable();
  }

  public dispatch(event: NewEvent): void {
    this._eventEmitter.next(event);
  }
}
