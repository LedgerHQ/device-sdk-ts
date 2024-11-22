import * as uuid from "uuid";
jest.mock("uuid");

import { Just, Left, type Maybe, Nothing, Right } from "purify-ts";

import { ApduResponse } from "@api/device-session/ApduResponse";
import { type ApduReceiverService } from "@api/device-session/service/ApduReceiverService";
import { ReceiverApduError } from "@internal/device-session/model/Errors";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";

import { DefaultApduReceiverService } from "./DefaultApduReceiverService";

const loggerService = new DefaultLoggerPublisherService([], "frame");

const RESPONSE_GET_VERSION = new Uint8Array([
  0xaa, 0xaa, 0x05, 0x00, 0x00, 0x00, 0x21, 0x33, 0x00, 0x00, 0x04, 0x05, 0x32,
  0x2e, 0x32, 0x2e, 0x33, 0x04, 0xe6, 0x00, 0x00, 0x00, 0x04, 0x32, 0x2e, 0x33,
  0x30, 0x04, 0x31, 0x2e, 0x31, 0x36, 0x01, 0x01, 0x01, 0x00, 0x01, 0x00, 0x90,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const RESPONSE_LOCKED_DEVICE = new Uint8Array([
  0xaa, 0xaa, 0x05, 0x00, 0x00, 0x00, 0x02, 0x55, 0x15, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const RESPONSE_LIST_APPS = [
  new Uint8Array([
    0xaa, 0xaa, 0x05, 0x00, 0x00, 0x00, 0x9e, 0x01, 0x4d, 0x00, 0x13, 0xca,
    0x50, 0xfa, 0xa1, 0x91, 0x40, 0x9a, 0x6b, 0xfa, 0x6c, 0x0f, 0xbb, 0xb2,
    0xe7, 0xc4, 0xa9, 0xcf, 0xe5, 0x57, 0x41, 0x00, 0x5d, 0xbd, 0x84, 0xab,
    0x9a, 0xbd, 0x66, 0xc7, 0x6c, 0x90, 0xdd, 0x08, 0x79, 0x0d, 0x08, 0x47,
    0xb9, 0x3a, 0x8f, 0xa7, 0x6f, 0x60, 0x33, 0xae, 0xd3, 0x25, 0xd7, 0xb1,
    0xe5, 0x7c, 0xeb, 0xd7,
  ]),
  new Uint8Array([
    0xaa, 0xaa, 0x05, 0x00, 0x01, 0x4b, 0x2e, 0x2c, 0x9f, 0xb4, 0x46, 0x78,
    0xde, 0x05, 0x5f, 0x9e, 0x80, 0x0a, 0x07, 0x42, 0x69, 0x74, 0x63, 0x6f,
    0x69, 0x6e, 0x4e, 0x00, 0x15, 0xca, 0x40, 0x06, 0x03, 0x28, 0xf8, 0x8f,
    0xc6, 0xd6, 0x42, 0x98, 0xd0, 0x49, 0x00, 0xc7, 0x04, 0x98, 0x19, 0x1b,
    0x6c, 0xeb, 0xed, 0xd8, 0xcb, 0x84, 0x5d, 0xf5, 0x4b, 0xe3, 0xbd, 0xbb,
    0x25, 0x7a, 0x3f, 0x6f,
  ]),
  new Uint8Array([
    0xaa, 0xaa, 0x05, 0x00, 0x02, 0x68, 0x8f, 0x54, 0xef, 0x7f, 0xaa, 0xc4,
    0x22, 0xaa, 0x54, 0xe7, 0xb8, 0x0a, 0xc8, 0xa3, 0x2f, 0x96, 0xe5, 0x5e,
    0x43, 0x2d, 0xf3, 0xa3, 0x45, 0x8d, 0x8e, 0xaa, 0xf1, 0x4e, 0xd1, 0x1e,
    0x08, 0x45, 0x74, 0x68, 0x65, 0x72, 0x65, 0x75, 0x6d, 0x90, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00,
  ]),
];

describe("DefaultApduReceiverService", () => {
  let service: ApduReceiverService;

  beforeAll(() => {
    jest.spyOn(uuid, "v4").mockReturnValue("42");
  });

  describe("without dataSize", () => {
    beforeEach(() => {
      service = new DefaultApduReceiverService(
        { channel: Just(new Uint8Array([0xaa, 0xaa])) },
        () => loggerService,
      );
    });

    it("should return a left error when the first frame has no dataSize", () => {
      //given
      const frame = RESPONSE_LIST_APPS[1]!;

      //when
      const apdu = service.handleFrame(frame);

      //then
      expect(apdu).toEqual(Left(new ReceiverApduError()));
    });
  });

  describe("[USB] With padding and channel", () => {
    beforeEach(() => {
      service = new DefaultApduReceiverService(
        { channel: Just(new Uint8Array([0xaa, 0xaa])) },
        () => loggerService,
      );
    });

    it("should return a response directly when a frame is complete", () => {
      // given
      const frame = RESPONSE_GET_VERSION;

      // when
      const apdu = service.handleFrame(frame);

      // then
      expect(apdu).toEqual(
        Right(
          Just(
            new ApduResponse({
              data: RESPONSE_GET_VERSION.slice(7, 38),
              statusCode: new Uint8Array([0x90, 0x00]),
            }),
          ),
        ),
      );
    });

    it("should return a response on a third frame when the two first are not complete", () => {
      //given
      const apdus = [...RESPONSE_LIST_APPS];

      //when
      let response: Maybe<ApduResponse> = Nothing;
      const responses: Maybe<ApduResponse>[] = [];
      while (response.isNothing()) {
        const apdu = apdus.shift()!;
        const either = service.handleFrame(apdu);

        either.map((value) => {
          response = value;
          responses.push(response);
        });
      }

      //then
      expect(responses).toEqual([
        Nothing,
        Nothing,
        Just(
          new ApduResponse({
            data: new Uint8Array([
              ...Array.from(RESPONSE_LIST_APPS[0]!.slice(7)),
              ...Array.from(RESPONSE_LIST_APPS[1]!.slice(5)),
              ...Array.from(RESPONSE_LIST_APPS[2]!).slice(5, 45),
            ]),
            statusCode: new Uint8Array([0x90, 0x00]),
          }),
        ),
      ]);
    });

    it("should return two response directly when each frame is complete", () => {
      // given
      const firstFrame = RESPONSE_LOCKED_DEVICE;
      const secondFrame = RESPONSE_GET_VERSION;

      // when
      const firstResponse = service.handleFrame(firstFrame);
      const secondResponse = service.handleFrame(secondFrame);

      // then
      expect(firstResponse).toEqual(
        Right(
          Just(
            new ApduResponse({
              data: new Uint8Array([]),
              statusCode: new Uint8Array([0x55, 0x15]),
            }),
          ),
        ),
      );
      expect(secondResponse).toEqual(
        Right(
          Just(
            new ApduResponse({
              data: RESPONSE_GET_VERSION.slice(7, 38),
              statusCode: new Uint8Array([0x90, 0x00]),
            }),
          ),
        ),
      );
    });

    it("should return an error if the frame is without index", () => {
      //given
      //frame with channelId, headTag, and partial Index only
      const frame = RESPONSE_LIST_APPS[0]!.slice(0, 4);

      //when
      const apdu = service.handleFrame(frame);

      //then
      expect(apdu).toEqual(
        Left(new ReceiverApduError("Unable to parse header from apdu")),
      );
    });

    it("should return an error if the frame is without datasize", () => {
      //given
      //frame with channelId, headTag, and Index and partial dataSize only
      const frame = RESPONSE_LIST_APPS[0]!.slice(0, 6);

      //when
      const apdu = service.handleFrame(frame);

      //then
      expect(apdu).toEqual(
        Left(new ReceiverApduError("Unable to parse header from apdu")),
      );
    });
  });

  describe("[BLE] Without padding nor channel", () => {
    beforeEach(() => {
      service = new DefaultApduReceiverService({}, () => loggerService);
    });

    it("should return a response directly when a frame is complete", () => {
      // given
      const frame = RESPONSE_GET_VERSION.slice(2, 40);

      // when
      const apdu = service.handleFrame(frame);

      // then
      expect(apdu).toEqual(
        Right(
          Just(
            new ApduResponse({
              data: RESPONSE_GET_VERSION.slice(7, 38),
              statusCode: new Uint8Array([0x90, 0x00]),
            }),
          ),
        ),
      );
    });

    it("should return a response on a third frame when the two first are not complete", () => {
      //given
      const apdus = [
        RESPONSE_LIST_APPS[0]!.slice(2),
        RESPONSE_LIST_APPS[1]!.slice(2),
        RESPONSE_LIST_APPS[2]!.slice(2, 47),
      ];

      //when
      let response: Maybe<ApduResponse> = Nothing;
      const responses: Maybe<ApduResponse>[] = [];
      while (response.isNothing()) {
        const apdu = apdus.shift()!;
        const either = service.handleFrame(apdu);

        either.map((value) => {
          response = value;
          responses.push(response);
        });
      }

      //then
      expect(responses).toEqual([
        Nothing,
        Nothing,
        Just(
          new ApduResponse({
            data: new Uint8Array([
              ...Array.from(RESPONSE_LIST_APPS[0]!.slice(7)),
              ...Array.from(RESPONSE_LIST_APPS[1]!.slice(5)),
              ...Array.from(RESPONSE_LIST_APPS[2]!).slice(5, 45),
            ]),
            statusCode: new Uint8Array([0x90, 0x00]),
          }),
        ),
      ]);
    });

    it("should return two response directly when each frame is complete", () => {
      // given
      const firstFrame = RESPONSE_LOCKED_DEVICE.slice(2, 9);
      const secondFrame = RESPONSE_GET_VERSION.slice(2, 40);

      // when
      const firstResponse = service.handleFrame(firstFrame);
      const secondResponse = service.handleFrame(secondFrame);

      // then
      expect(firstResponse).toEqual(
        Right(
          Just(
            new ApduResponse({
              data: new Uint8Array([]),
              statusCode: new Uint8Array([0x55, 0x15]),
            }),
          ),
        ),
      );
      expect(secondResponse).toEqual(
        Right(
          Just(
            new ApduResponse({
              data: RESPONSE_GET_VERSION.slice(7, 38),
              statusCode: new Uint8Array([0x90, 0x00]),
            }),
          ),
        ),
      );
    });

    it("should return an error if the frame is without index", () => {
      //given
      //frame with channelId, headTag, and partial Index only
      const frame = RESPONSE_LIST_APPS[0]!.slice(2, 4);

      //when
      const apdu = service.handleFrame(frame);

      //then
      expect(apdu).toEqual(
        Left(new ReceiverApduError("Unable to parse header from apdu")),
      );
    });

    it("should return an error if the frame is without datasize", () => {
      //given
      //frame with channelId, headTag, and Index and partial dataSize only
      const frame = RESPONSE_LIST_APPS[0]!.slice(2, 6);

      //when
      const apdu = service.handleFrame(frame);

      //then
      expect(apdu).toEqual(
        Left(new ReceiverApduError("Unable to parse header from apdu")),
      );
    });
  });
});
