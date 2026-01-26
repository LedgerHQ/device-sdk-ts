import { CommandResultFactory } from "@ledgerhq/device-management-kit";
import { InvalidStatusWordError } from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { SignEIP7702AuthorizationCommand } from "@internal/app-binder/command/SignAuthorizationDelegationCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SendSignAuthorizationDelegationTask } from "./SendSignAuthorizationDelegationTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const SMALL_MESSAGE_DATA = new Uint8Array([
  0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0x3c, 0x80, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2d, 0x00, 0x01, 0x01,
  0x01, 0x14, 0x4c, 0xd2, 0x41, 0xe8, 0xd1, 0x51, 0x0e, 0x30, 0xb2, 0x07, 0x63,
  0x97, 0xaf, 0xc7, 0x50, 0x8a, 0xe5, 0x9c, 0x66, 0xc9, 0x02, 0x08, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x03, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x29,
]);

const LONG_MESSAGE_DATA = new Uint8Array([
  0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0x3c, 0x80, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x09, 0x00, 0x01, 0x01,
  0x01, 0xf0, 0x4c, 0xd2, 0x41, 0xe8, 0xd1, 0x51, 0x0e, 0x30, 0xb2, 0x07, 0x63,
  0x97, 0xaf, 0xc7, 0x50, 0x8a, 0xe5, 0x9c, 0x66, 0xc9, 0x4c, 0xd2, 0x41, 0xe8,
  0xd1, 0x51, 0x0e, 0x30, 0xb2, 0x07, 0x63, 0x97, 0xaf, 0xc7, 0x50, 0x8a, 0xe5,
  0x9c, 0x66, 0xc9, 0x4c, 0xd2, 0x41, 0xe8, 0xd1, 0x51, 0x0e, 0x30, 0xb2, 0x07,
  0x63, 0x97, 0xaf, 0xc7, 0x50, 0x8a, 0xe5, 0x9c, 0x66, 0xc9, 0x4c, 0xd2, 0x41,
  0xe8, 0xd1, 0x51, 0x0e, 0x30, 0xb2, 0x07, 0x63, 0x97, 0xaf, 0xc7, 0x50, 0x8a,
  0xe5, 0x9c, 0x66, 0xc9, 0x4c, 0xd2, 0x41, 0xe8, 0xd1, 0x51, 0x0e, 0x30, 0xb2,
  0x07, 0x63, 0x97, 0xaf, 0xc7, 0x50, 0x8a, 0xe5, 0x9c, 0x66, 0xc9, 0x4c, 0xd2,
  0x41, 0xe8, 0xd1, 0x51, 0x0e, 0x30, 0xb2, 0x07, 0x63, 0x97, 0xaf, 0xc7, 0x50,
  0x8a, 0xe5, 0x9c, 0x66, 0xc9, 0x4c, 0xd2, 0x41, 0xe8, 0xd1, 0x51, 0x0e, 0x30,
  0xb2, 0x07, 0x63, 0x97, 0xaf, 0xc7, 0x50, 0x8a, 0xe5, 0x9c, 0x66, 0xc9, 0x4c,
  0xd2, 0x41, 0xe8, 0xd1, 0x51, 0x0e, 0x30, 0xb2, 0x07, 0x63, 0x97, 0xaf, 0xc7,
  0x50, 0x8a, 0xe5, 0x9c, 0x66, 0xc9, 0x4c, 0xd2, 0x41, 0xe8, 0xd1, 0x51, 0x0e,
  0x30, 0xb2, 0x07, 0x63, 0x97, 0xaf, 0xc7, 0x50, 0x8a, 0xe5, 0x9c, 0x66, 0xc9,
  0x4c, 0xd2, 0x41, 0xe8, 0xd1, 0x51, 0x0e, 0x30, 0xb2, 0x07, 0x63, 0x97, 0xaf,
  0xc7, 0x50, 0x8a, 0xe5, 0x9c, 0x66, 0xc9, 0x4c, 0xd2, 0x41, 0xe8, 0xd1, 0x51,
  0x0e, 0x30, 0xb2, 0x07, 0x63, 0x97, 0xaf, 0xc7, 0x50, 0x8a, 0xe5, 0x9c, 0x66,
  0xc9, 0x4c, 0xd2, 0x41, 0xe8, 0xd1, 0x51, 0x0e, 0x30, 0xb2, 0x07, 0x63, 0x97,
  0xaf, 0xc7, 0x50, 0x8a, 0xe5, 0x9c, 0x66, 0xc9, 0x02, 0x08, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x03, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x29,
]);

describe("SendSignAuthorizationDelegationTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const signature = {
    v: 27,
    r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    s: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  };
  const resultOk = CommandResultFactory({
    data: Just(signature),
  });
  const resultNothing = CommandResultFactory({ data: Nothing });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("run", () => {
    it("should send the message in chunks", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        address: "0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9",
        chainId: 1,
        nonce: 41,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(resultOk);
      apiMock.sendCommand.mockResolvedValueOnce(resultNothing);

      // WHEN
      const result = await new SendSignAuthorizationDelegationTask(
        apiMock,
        args,
      ).run();

      // THEN
      expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
      expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
        new SignEIP7702AuthorizationCommand({
          data: new Uint8Array(SMALL_MESSAGE_DATA),
          isFirstChunk: true,
        }),
      );
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      expect((result as any).data).toStrictEqual(signature);
    });

    it("should send the long message in chunks", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        address:
          "0x4Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c94Cd241E8d1510e30b2076397afc7508Ae59C66c9",
        chainId: 1,
        nonce: 41,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(resultNothing);
      apiMock.sendCommand.mockResolvedValueOnce(resultOk);

      // WHEN
      const result = await new SendSignAuthorizationDelegationTask(
        apiMock,
        args,
      ).run();

      // THEN
      expect(apiMock.sendCommand.mock.calls).toHaveLength(2);
      expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
        new SignEIP7702AuthorizationCommand({
          data: LONG_MESSAGE_DATA.slice(0, 255),
          isFirstChunk: true,
        }),
      );
      expect(apiMock.sendCommand.mock.calls[1]![0]).toStrictEqual(
        new SignEIP7702AuthorizationCommand({
          data: LONG_MESSAGE_DATA.slice(255, 510),
          isFirstChunk: false,
        }),
      );
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      expect((result as any).data).toStrictEqual(signature);
    });

    it("should return an error if the command fails", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        address: "0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9",
        chainId: 1,
        nonce: 41,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("An error"),
        }),
      );

      // WHEN
      const result = await new SendSignAuthorizationDelegationTask(
        apiMock,
        args,
      ).run();

      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("An error"),
        }),
      );
    });

    it("should return an error if the command returns no data", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        address: "0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9",
        chainId: 1,
        nonce: 41,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(resultNothing);

      // WHEN
      const result = await new SendSignAuthorizationDelegationTask(
        apiMock,
        args,
      ).run();

      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("no signature returned"),
        }),
      );
    });
  });
});
