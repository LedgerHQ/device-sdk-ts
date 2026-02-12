import { CommandResultFactory } from "@ledgerhq/device-management-kit";
import { Just } from "purify-ts";

import { SignEIP712Command } from "@internal/app-binder/command/SignEIP712Command";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SignTypedDataLegacyTask } from "./SignTypedDataLegacyTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const mockLoggerFactory = (_tag: string) => mockLogger;

describe("SignTypedDataLegacyTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  const TEST_DATA = {
    domain: {
      name: "Permit2",
      chainId: 137,
      verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
    },
    primaryType: "PermitSingle",
    message: {
      details: {
        token: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
        amount: "69420000000000000000",
        expiration: "1718184249",
        nonce: "0",
      },
      spender: "0xec7be89e9d109e7e3fec59c222cf297125fefda2",
      sigDeadline: "1715594049",
    },
    types: {
      PermitSingle: [
        {
          name: "details",
          type: "PermitDetails",
        },
        {
          name: "spender",
          type: "address",
        },
        {
          name: "sigDeadline",
          type: "uint256",
        },
      ],
      PermitDetails: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint" },
        { name: "expiration", type: "uint" },
        { name: "nonce", type: "uint" },
      ],
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("Successful legagy signing", async () => {
    // GIVEN
    const task = new SignTypedDataLegacyTask(
      apiMock,
      TEST_DATA,
      "44'/60'/0'/0/0",
      mockLoggerFactory,
    );
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({
        data: {
          r: "0x24",
          s: "0x42",
          v: 0,
        },
      }),
    );
    // WHEN
    const signature = await task.run();
    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new SignEIP712Command({
        derivationPath: "44'/60'/0'/0/0",
        legacyArgs: Just({
          domainHash:
            "0xf033048cb2764f596bc4d98e089fa38bb84b4be3d5da2e77f9bfac0e4d6c68ca",
          messageHash:
            "0x1087495b5e10337738059920fe1de8216235299745e8c97e21b409009a4c362a",
        }),
      }),
    );
    expect(signature).toStrictEqual(
      CommandResultFactory({
        data: {
          r: "0x24",
          s: "0x42",
          v: 0,
        },
      }),
    );
  });

  it("Should throw error if no primary type", async () => {
    // GIVEN
    const task = new SignTypedDataLegacyTask(
      apiMock,
      {
        ...TEST_DATA,
        primaryType: "Wat?",
      },
      "44'/60'/0'/0/0",
      mockLoggerFactory,
    );
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({
        data: {
          r: "0x24",
          s: "0x42",
          v: 0,
        },
      }),
    );
    // WHEN
    try {
      await task.run();
    } catch (e) {
      // THEN
      expect(e).toBeInstanceOf(Error);
      // @ts-expect-error
      expect(e.message).toBe(
        'Primary type "Wat?" is not defined in the types.',
      );
    }
  });
});
