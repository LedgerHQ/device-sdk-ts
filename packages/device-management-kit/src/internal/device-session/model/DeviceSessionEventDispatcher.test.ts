import { describe, expect, it } from "vitest";

import { type GetAppAndVersionResponse } from "@api/index";
import type { CommandResult } from "@api/types";

import {
  DeviceSessionEventDispatcher,
  type NewEvent,
  SessionEvents,
} from "./DeviceSessionEventDispatcher";

describe("DeviceSessionEventDispatcher", () => {
  let dispatcher: DeviceSessionEventDispatcher;

  beforeEach(() => {
    dispatcher = new DeviceSessionEventDispatcher();
  });

  it("should dispatch and receive an event without payload", () =>
    new Promise((resolve, reject) => {
      // given
      const expectedEvent: NewEvent = {
        eventName: SessionEvents.REFRESH_NEEDED,
        eventData: undefined,
      };

      // when
      const subscription = dispatcher.listen().subscribe((event) => {
        // then
        try {
          expect(event).toEqual(expectedEvent);
          resolve(undefined);
        } catch (error) {
          reject(error);
        } finally {
          subscription.unsubscribe();
        }
      });

      dispatcher.dispatch(expectedEvent);
    }));

  it("should dispatch and receive a COMMAND_SUCCEEDED event with payload", () =>
    new Promise((resolve, reject) => {
      // given
      const dummyCommandResult = {
        status: "success",
        data: { someField: "dummyValue" },
      } as unknown as CommandResult<GetAppAndVersionResponse>;

      const expectedEvent: NewEvent = {
        eventName: SessionEvents.COMMAND_SUCCEEDED,
        eventData: dummyCommandResult,
      };

      // when
      const subscription = dispatcher.listen().subscribe((event) => {
        if (event.eventName === SessionEvents.COMMAND_SUCCEEDED) {
          // then
          try {
            expect(event).toEqual(expectedEvent);
            resolve(undefined);
          } catch (error) {
            reject(error);
          } finally {
            subscription.unsubscribe();
          }
        }
      });

      dispatcher.dispatch(expectedEvent);
    }));

  it("should dispatch multiple events", () =>
    new Promise((resolve, reject) => {
      // given
      const events: NewEvent[] = [
        {
          eventName: SessionEvents.DEVICE_STATE_UPDATE_BUSY,
          eventData: undefined,
        },
        {
          eventName: SessionEvents.DEVICE_STATE_UPDATE_CONNECTED,
          eventData: undefined,
        },
      ];
      const received: NewEvent[] = [];

      // when
      const subscription = dispatcher.listen().subscribe((event) => {
        received.push(event);

        // then
        if (received.length === events.length) {
          try {
            expect(received).toEqual(events);
            resolve(undefined);
          } catch (error) {
            reject(error);
          } finally {
            subscription.unsubscribe();
          }
        }
      });

      events.forEach((event) => dispatcher.dispatch(event));
    }));
});
