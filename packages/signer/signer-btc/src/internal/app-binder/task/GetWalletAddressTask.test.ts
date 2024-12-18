/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type ApduResponse,
  CommandResultFactory,
  CommandResultStatus,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { ClientCommandHandlerError } from "@internal/app-binder/command/client-command-handlers/Errors";
import { ContinueCommand } from "@internal/app-binder/command/ContinueCommand";
import { GetWalletAddressCommand } from "@internal/app-binder/command/GetWalletAddressCommand";
import { ClientCommandInterpreter } from "@internal/app-binder/command/service/ClientCommandInterpreter";
import {
  ClientCommandCodes,
  SW_INTERRUPTED_EXECUTION,
} from "@internal/app-binder/command/utils/constants";
import { type Wallet } from "@internal/wallet/model/Wallet";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";

import { GetWalletAddressTask } from "./GetWalletAddressTask";

const DISPLAY = true;
const CHANGE = false;
const ADDRESS_INDEX = 0;
const TEST_ADDRESS = "bc1qexampleaddress";
const REGISTERED_WALLET_ID = new Uint8Array(32).fill(0xaf);
const REGISTERED_WALLET_HMAC = new Uint8Array(32).fill(0xfa);

const MOCK_WALLET: Wallet = {
  hmac: REGISTERED_WALLET_HMAC,
  name: "TestWallet",
  descriptorTemplate: "wpkh([fingerprint/]/0h/0h/0h)",
  keys: [],
  //@ts-ignore
  keysTree: {},
  descriptorBuffer: new Uint8Array(),
};

describe("GetWalletAddressTask", () => {
  const apiMock = {
    sendCommand: jest.fn(),
  } as unknown as InternalApi;

  const addressResponse = CommandResultFactory({
    data: { address: TEST_ADDRESS },
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should return address if initial GET_WALLET_ADDRESS command succeeds", async () => {
    // GIVEN
    (apiMock.sendCommand as jest.Mock).mockResolvedValueOnce(addressResponse);

    jest
      .spyOn(DefaultWalletSerializer.prototype, "serialize")
      .mockReturnValue(REGISTERED_WALLET_ID);

    // WHEN
    const result = await new GetWalletAddressTask(apiMock, {
      display: DISPLAY,
      wallet: MOCK_WALLET,
      change: CHANGE,
      addressIndex: ADDRESS_INDEX,
    }).run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      expect.any(GetWalletAddressCommand),
    );
    expect(result).toStrictEqual(addressResponse);
  });

  it("should handle interactive requests after an interrupted execution", async () => {
    // GIVEN
    (apiMock.sendCommand as jest.Mock)
      .mockResolvedValueOnce(
        CommandResultFactory({
          data: {
            statusCode: SW_INTERRUPTED_EXECUTION,
            data: new Uint8Array([ClientCommandCodes.YIELD]),
          },
        }),
      ) // first GET_WALLET_ADDRESS
      .mockResolvedValueOnce(addressResponse); // after CONTINUE

    jest
      .spyOn(DefaultWalletSerializer.prototype, "serialize")
      .mockReturnValue(REGISTERED_WALLET_ID);

    jest
      .spyOn(ClientCommandInterpreter.prototype, "getClientCommandPayload")
      .mockImplementation((request: Uint8Array, context: any) => {
        // Simulate YIELD command
        if (request[0] === ClientCommandCodes.YIELD) {
          context.yieldedResults.push(new Uint8Array([]));
          return Right(new Uint8Array([0x00]));
        }
        return Left(new ClientCommandHandlerError("Unexpected command"));
      });

    // WHEN
    const result = await new GetWalletAddressTask(apiMock, {
      display: DISPLAY,
      wallet: MOCK_WALLET,
      change: CHANGE,
      addressIndex: ADDRESS_INDEX,
    }).run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      2,
      expect.any(ContinueCommand),
    );
    expect(result).toStrictEqual(addressResponse);
  });

  it("should fail if initial GET_WALLET_ADDRESS command fails", async () => {
    // GIVEN
    const getAddrFail = CommandResultFactory({
      error: new InvalidStatusWordError("Failed"),
    });

    (apiMock.sendCommand as jest.Mock).mockResolvedValueOnce(getAddrFail);

    // WHEN
    const result = await new GetWalletAddressTask(apiMock, {
      display: DISPLAY,
      wallet: MOCK_WALLET,
      change: CHANGE,
      addressIndex: ADDRESS_INDEX,
    }).run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(CommandResultStatus.Error);
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError(
          "Invalid initial GET_WALLET_ADDRESS response",
        ),
      }),
    );
  });

  it("should fail if no address is extracted after all continuations", async () => {
    // GIVEN
    // simulate a continue response but never get a final address
    const continueResponse: ApduResponse = {
      statusCode: SW_INTERRUPTED_EXECUTION,
      data: new Uint8Array([ClientCommandCodes.YIELD]),
    };

    (apiMock.sendCommand as jest.Mock)
      .mockResolvedValueOnce(CommandResultFactory({ data: continueResponse }))
      .mockResolvedValueOnce(CommandResultFactory({ data: continueResponse }));

    jest
      .spyOn(ClientCommandInterpreter.prototype, "getClientCommandPayload")
      .mockImplementation(() => Right(new Uint8Array([0x00])));

    // eventually we'll fail to retrieve a final address
    (apiMock.sendCommand as jest.Mock).mockImplementationOnce(async () => {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Failed to get final wallet address response",
        ),
      });
    });

    // WHEN
    const result = await new GetWalletAddressTask(apiMock, {
      display: DISPLAY,
      wallet: MOCK_WALLET,
      change: CHANGE,
      addressIndex: ADDRESS_INDEX,
    }).run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);
    expect(result.status).toBe(CommandResultStatus.Error);
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError(
          "Failed to get final wallet address response",
        ),
      }),
    );
  });
});
