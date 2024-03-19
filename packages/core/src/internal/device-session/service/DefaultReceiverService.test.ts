import * as uuid from "uuid";
jest.mock("uuid");

import { Maybe } from "purify-ts";

import { Frame } from "@internal/device-session/model/Frame";
import { FrameHeader } from "@internal/device-session/model/FrameHeader";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";

import { DefaultReceiverService } from "./DefaultReceiverService";

const loggerService = new DefaultLoggerPublisherService([], "frame");

describe("DefaultReceiverService", () => {
  beforeAll(() => {
    jest.spyOn(uuid, "v4").mockReturnValue("42");
  });

  it("should return 1 frame", () => {
    // given
    const service = new DefaultReceiverService(() => loggerService);
    // getVersion APDU
    const frame = new Frame({
      header: new FrameHeader({
        uuid: "42",
        channel: Maybe.of(new Uint8Array([0x12, 0x34])),
        headTag: new Uint8Array([0x05]),
        dataSize: Maybe.of(new Uint8Array([0x02, 0x0])),
        index: new Uint8Array([0, 0]),
        length: 7,
      }),
      data: new Uint8Array([0xe0, 0x01]),
    });

    // when
    const apdu = service.getApdu(frame);

    // then
    expect(apdu).toEqual(new Uint8Array([0xe0, 0x01]));
  });
});
