import * as uuid from "uuid";
jest.mock("uuid");

import { Left, Right } from "purify-ts";

import { Frame } from "@internal/device-session/model/Frame";
import { FrameHeader } from "@internal/device-session/model/FrameHeader";

import { DefaultFramerService } from "./DefaultFramerService";

describe("DefaultFramerService", () => {
  beforeEach(() => {
    jest.spyOn(uuid, "v4").mockReturnValue("42");
  });
  it("should return 1 frame with padding, channel and bigger packetSize", () => {
    // given
    const channel = new Uint8Array([0x12, 0x34]);
    const framerService = new DefaultFramerService({
      packetSize: 64,
      padding: true,
      channel,
    });
    // getVersion APDU
    const apdu = new Uint8Array([0xe0, 0x01, 0x00, 0x00, 0x00]);

    // when
    const frames = framerService.getFrames(apdu);

    // then
    console.log(frames);
    expect(frames).toEqual([
      new Frame({
        header: new FrameHeader({
          uuid: "42",
          channel: new Uint8Array([0x12, 0x34]),
          headTag: new Uint8Array([0x05]),
          dataSize: Right(new Uint8Array([0, 0x05])),
          index: new Uint8Array([0, 0]),
          length: 7,
        }),
        data: new Uint8Array([
          0xe0, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00,
        ]),
      }),
    ]);
  });

  it("should return 2 frames with padding, channel and bigger packetSize", () => {
    // given
    const channel = new Uint8Array([0x12, 0x34]);
    const framerService = new DefaultFramerService({
      packetSize: 64,
      padding: true,
      channel,
    });
    const apdu = new Uint8Array([
      // editDeviceName APDU
      0xe0, 0xd4, 0x00, 0x00, 0x40,
      // editDeviceNameData
      0x54, 0x6f, 0x66, 0x75, 0x49, 0x73, 0x4e, 0x75, 0x74, 0x72, 0x69, 0x74,
      0x69, 0x6f, 0x75, 0x73, 0x41, 0x6e, 0x64, 0x42, 0x72, 0x69, 0x6e, 0x67,
      0x73, 0x4a, 0x6f, 0x79, 0x44, 0x65, 0x6c, 0x69, 0x67, 0x68, 0x74, 0x48,
      0x65, 0x61, 0x6c, 0x74, 0x68, 0x69, 0x6e, 0x65, 0x73, 0x73, 0x48, 0x61,
      0x72, 0x6d, 0x6f, 0x6e, 0x79, 0x49, 0x6e, 0x45, 0x76, 0x65, 0x72, 0x79,
      0x42, 0x69, 0x74, 0x65,
    ]);
    console.log(apdu);

    // when
    const frames = framerService.getFrames(apdu);

    // then
    expect(frames).toEqual([
      new Frame({
        header: new FrameHeader({
          uuid: "42",
          channel: new Uint8Array([0x12, 0x34]),
          headTag: new Uint8Array([0x05]),
          dataSize: Right(new Uint8Array([0x00, 0x45])),
          index: new Uint8Array([0x00, 0x00]),
          length: 7,
        }),
        data: new Uint8Array([
          0xe0, 0xd4, 0x00, 0x00, 0x40, 0x54, 0x6f, 0x66, 0x75, 0x49, 0x73,
          0x4e, 0x75, 0x74, 0x72, 0x69, 0x74, 0x69, 0x6f, 0x75, 0x73, 0x41,
          0x6e, 0x64, 0x42, 0x72, 0x69, 0x6e, 0x67, 0x73, 0x4a, 0x6f, 0x79,
          0x44, 0x65, 0x6c, 0x69, 0x67, 0x68, 0x74, 0x48, 0x65, 0x61, 0x6c,
          0x74, 0x68, 0x69, 0x6e, 0x65, 0x73, 0x73, 0x48, 0x61, 0x72, 0x6d,
          0x6f, 0x6e,
        ]),
      }),
      new Frame({
        header: new FrameHeader({
          uuid: "42",
          channel: new Uint8Array([0x12, 0x34]),
          headTag: new Uint8Array([0x05]),
          index: new Uint8Array([0x00, 0x01]),
          length: 5,
          dataSize: Left(undefined),
        }),
        data: new Uint8Array([
          0x79, 0x49, 0x6e, 0x45, 0x76, 0x65, 0x72, 0x79, 0x42, 0x69, 0x74,
          0x65, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00,
        ]),
      }),
    ]);
  });

  it("should return 1 frame without padding nor channel, with bigger packetSize", () => {
    // given
    const framerService = new DefaultFramerService({
      packetSize: 64,
      channel: new Uint8Array([0x12, 0x34]),
    });
    const command = new Uint8Array([0xe0, 0x01, 0x00, 0x00, 0x00]);

    // when
    const frames = framerService.getFrames(command);

    // then
    expect(frames).toEqual([
      new Frame({
        header: new FrameHeader({
          uuid: "42",
          channel: new Uint8Array([0x12, 0x34]),
          headTag: new Uint8Array([0x05]),
          dataSize: Right(new Uint8Array([0, 5])),
          index: new Uint8Array([0, 0]),
          length: 7,
        }),
        data: new Uint8Array([0xe0, 0x01, 0x00, 0x00, 0x00]),
      }),
    ]);
  });

  it("should return 2 frames without padding nor channel, with smaller packet size", () => {
    // given
    const framerService = new DefaultFramerService({
      packetSize: 10,
    });
    const command = new Uint8Array([
      0x01, 0x05, 0x4f, 0x4c, 0x4f, 0x53, 0x00, 0x07, 0x2e, 0x32, 0x2e, 0x34,
      0x2d, 0x32, 0x00, 0x90, 0x00,
    ]);

    // when
    const frames = framerService.getFrames(command);

    // then
    expect(frames).toEqual([
      new Frame({
        header: new FrameHeader({
          uuid: "42",
          headTag: new Uint8Array([0x05]),
          index: new Uint8Array([0, 0]),
          dataSize: Right(new Uint8Array([0, 0x11])),
          length: 5,
        }),
        data: new Uint8Array([0x01, 0x05, 0x4f, 0x4c, 0x4f]),
      }),
      new Frame({
        header: new FrameHeader({
          uuid: "42",
          headTag: new Uint8Array([0x05]),
          dataSize: Left(undefined),
          index: new Uint8Array([0, 0x01]),
          length: 3,
        }),
        data: new Uint8Array([0x53, 0x00, 0x07, 0x2e, 0x32, 0x2e, 0x34]),
      }),
      new Frame({
        header: new FrameHeader({
          uuid: "42",
          headTag: new Uint8Array([0x05]),
          dataSize: Left(undefined),
          index: new Uint8Array([0, 0x02]),
          length: 3,
        }),
        data: new Uint8Array([0x2d, 0x32, 0x00, 0x90, 0x00]),
      }),
    ]);
  });

  it("should return empty if packet size smaller than header size", () => {
    const framerService = new DefaultFramerService({
      packetSize: Math.random() & 4,
      channel: new Uint8Array([0x12, 0x34]),
    });
    const command = new Uint8Array([0xe0, 0x01, 0x00, 0x00, 0x00]);

    // when
    const frames = framerService.getFrames(command);

    // then
    expect(frames).toBe(new Uint8Array([]));
  });

  it("should return empty if no apdu length", () => {
    const framerService = new DefaultFramerService({
      // random packetSize < 0xff
      packetSize: Math.random() & 0xff,
      // random padding boolean
      padding: Math.random() > 0.5,
      channel: new Uint8Array([0x12, 0x34]),
    });
    const command = new Uint8Array([]);

    // when
    const frames = framerService.getFrames(command);

    // then
    expect(frames).toBe(new Uint8Array([]));
  });
});
