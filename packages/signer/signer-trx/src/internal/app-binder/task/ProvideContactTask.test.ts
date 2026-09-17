import {
  sendProvideContactPayload,
  type SendProvideContactPayloadArgs,
} from "@ledgerhq/device-contacts-kit";
import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { EMPTY_TRON_ADDRESS_BOOK } from "@api/model/TronAddressBook";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { buildExternalContactPayload } from "@internal/shared/utils/buildExternalContactPayload";
import { extractTransactionRecipient } from "@internal/shared/utils/extractTransactionRecipient";

import { ProvideContactTask } from "./ProvideContactTask";

vi.mock("@ledgerhq/device-contacts-kit", async (importOriginal) => ({
  ...(await importOriginal()),
  sendProvideContactPayload: vi.fn(),
}));
vi.mock("@internal/shared/utils/buildExternalContactPayload", () => ({
  buildExternalContactPayload: vi.fn(),
}));
vi.mock("@internal/shared/utils/extractTransactionRecipient", () => ({
  extractTransactionRecipient: vi.fn(),
}));

const TRANSACTION = new Uint8Array([0x01]);
const RECIPIENT = new Uint8Array(21).fill(0x11);
const PAYLOAD = new Uint8Array([0xaa]);
const APP_CONFIG = {
  version: "0.8.0",
  versionN: 800,
  allowData: true,
  allowContract: true,
  truncateAddress: false,
  signByHash: false,
};

describe("ProvideContactTask", () => {
  const api = makeDeviceActionInternalApiMock();
  const args = {
    addressBook: EMPTY_TRON_ADDRESS_BOOK,
    transaction: TRANSACTION,
    appConfig: APP_CONFIG,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractTransactionRecipient).mockReturnValue(RECIPIENT);
    vi.mocked(buildExternalContactPayload).mockReturnValue(PAYLOAD);
    vi.mocked(sendProvideContactPayload).mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
  });

  it("provides a matching contact", async () => {
    await new ProvideContactTask(api, args).run();

    expect(sendProvideContactPayload).toHaveBeenCalledWith(
      api,
      expect.objectContaining({
        payload: PAYLOAD,
      }) as SendProvideContactPayloadArgs,
    );
  });

  it("continues when the device rejects the contact", async () => {
    vi.mocked(sendProvideContactPayload).mockResolvedValue(
      CommandResultFactory({
        error: new InvalidStatusWordError("rejected"),
      }) as never,
    );

    await expect(
      new ProvideContactTask(api, args).run(),
    ).resolves.toBeUndefined();
  });

  it("does not send anything without a recipient", async () => {
    vi.mocked(extractTransactionRecipient).mockReturnValue(undefined);

    await new ProvideContactTask(api, args).run();

    expect(sendProvideContactPayload).not.toHaveBeenCalled();
  });
});
