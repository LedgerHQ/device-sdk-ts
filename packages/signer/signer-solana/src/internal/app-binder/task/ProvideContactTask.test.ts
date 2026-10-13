import {
  sendProvideContactPayload,
  type SendProvideContactPayloadArgs,
} from "@ledgerhq/device-contacts-kit";
import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Keypair } from "@solana/web3.js";

import {
  EMPTY_SOLANA_ADDRESS_BOOK,
  type SolanaAddressBook,
} from "@api/model/SolanaAddressBook";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import {
  buildExternalContactPayload,
  buildOwnerContactPayload,
} from "@internal/app-binder/services/contacts/buildExternalContactPayload";
import {
  extractTransferRecipient,
  type TransferRecipient,
} from "@internal/app-binder/services/contacts/extractTransferRecipient";
import { TOKEN_PROGRAM_ID } from "@internal/app-binder/services/utils/splToken";

import { ProvideContactTask } from "./ProvideContactTask";

vi.mock("@ledgerhq/device-contacts-kit", async (importOriginal) => ({
  ...(await importOriginal()),
  sendProvideContactPayload: vi.fn(),
}));
vi.mock(
  "@internal/app-binder/services/contacts/buildExternalContactPayload",
  async (importOriginal) => ({
    ...(await importOriginal()),
    buildExternalContactPayload: vi.fn(),
    buildOwnerContactPayload: vi.fn(),
  }),
);
vi.mock(
  "@internal/app-binder/services/contacts/extractTransferRecipient",
  () => ({ extractTransferRecipient: vi.fn() }),
);

const MESSAGE_BYTES = new Uint8Array([0x01]);
const RECIPIENT = {
  kind: "native",
  address: Keypair.generate().publicKey,
} as const;
const PAYLOAD = new Uint8Array([0xaa]);
const ADDRESS_BOOK: SolanaAddressBook = {
  contactGroups: [
    {
      contactName: "Alice",
      groupHandle: new Uint8Array(64),
      hmacProof: new Uint8Array(32),
      externalAddresses: [
        {
          scope: "Solana",
          address: RECIPIENT.address.toBase58(),
          hmacRest: new Uint8Array(32),
        },
      ],
    },
  ],
  ledgerAccounts: [],
};

describe("ProvideContactTask", () => {
  const api = makeDeviceActionInternalApiMock();
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  };
  const args = {
    addressBook: ADDRESS_BOOK,
    messageBytes: MESSAGE_BYTES,
    match: { by: "recipient" },
    logger,
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractTransferRecipient).mockResolvedValue(RECIPIENT);
    vi.mocked(buildExternalContactPayload).mockReturnValue(PAYLOAD);
    vi.mocked(sendProvideContactPayload).mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
  });

  it("provides the contact matching the transfer recipient", async () => {
    await expect(new ProvideContactTask(api, args).run()).resolves.toBe(true);

    expect(extractTransferRecipient).toHaveBeenCalledWith(MESSAGE_BYTES);
    expect(buildExternalContactPayload).toHaveBeenCalledWith({
      addressBook: ADDRESS_BOOK,
      recipient: RECIPIENT,
    });
    expect(sendProvideContactPayload).toHaveBeenCalledWith(api, {
      payload: PAYLOAD,
      logger,
    } satisfies SendProvideContactPayloadArgs);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns and resolves when the device rejects the contact", async () => {
    vi.mocked(sendProvideContactPayload).mockResolvedValue(
      CommandResultFactory({
        error: new InvalidStatusWordError("rejected"),
      }) as never,
    );

    await expect(new ProvideContactTask(api, args).run()).resolves.toBe(true);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("does not parse the transaction without contacts", async () => {
    await expect(
      new ProvideContactTask(api, {
        ...args,
        addressBook: EMPTY_SOLANA_ADDRESS_BOOK,
      }).run(),
    ).resolves.toBe(false);

    expect(extractTransferRecipient).not.toHaveBeenCalled();
    expect(sendProvideContactPayload).not.toHaveBeenCalled();
  });

  it("does not send anything without a single recipient", async () => {
    vi.mocked(extractTransferRecipient).mockResolvedValue(undefined);

    await expect(new ProvideContactTask(api, args).run()).resolves.toBe(false);

    expect(buildExternalContactPayload).not.toHaveBeenCalled();
    expect(sendProvideContactPayload).not.toHaveBeenCalled();
  });

  it("does not send anything when no contact matches", async () => {
    vi.mocked(buildExternalContactPayload).mockReturnValue(undefined);

    await expect(new ProvideContactTask(api, args).run()).resolves.toBe(false);

    expect(sendProvideContactPayload).not.toHaveBeenCalled();
  });

  describe("matching through attested token account owners", () => {
    const TOKEN_ACCOUNT = Keypair.generate().publicKey;
    const TOKEN_RECIPIENT: TransferRecipient = {
      kind: "token",
      tokenAccount: TOKEN_ACCOUNT,
      mint: undefined,
      tokenProgram: TOKEN_PROGRAM_ID,
    };
    const tokenAccountOwners = {
      [TOKEN_ACCOUNT.toBase58()]: Keypair.generate().publicKey.toBase58(),
    };
    const ownerArgs = {
      ...args,
      match: { by: "tokenAccountOwner", tokenAccountOwners },
    } as const;

    beforeEach(() => {
      vi.mocked(extractTransferRecipient).mockResolvedValue(TOKEN_RECIPIENT);
      vi.mocked(buildOwnerContactPayload).mockReturnValue(PAYLOAD);
    });

    it("provides the contact owning the recipient token account", async () => {
      await expect(new ProvideContactTask(api, ownerArgs).run()).resolves.toBe(
        true,
      );

      expect(buildOwnerContactPayload).toHaveBeenCalledWith({
        addressBook: ADDRESS_BOOK,
        recipient: TOKEN_RECIPIENT,
        tokenAccountOwners,
      });
      expect(buildExternalContactPayload).not.toHaveBeenCalled();
      expect(sendProvideContactPayload).toHaveBeenCalledWith(api, {
        payload: PAYLOAD,
        logger,
      } satisfies SendProvideContactPayloadArgs);
    });

    it("does not send anything when no owner matches", async () => {
      vi.mocked(buildOwnerContactPayload).mockReturnValue(undefined);

      await expect(new ProvideContactTask(api, ownerArgs).run()).resolves.toBe(
        false,
      );

      expect(sendProvideContactPayload).not.toHaveBeenCalled();
    });
  });

  it("matches the recipient directly, never through an owner", async () => {
    await new ProvideContactTask(api, args).run();

    expect(buildOwnerContactPayload).not.toHaveBeenCalled();
  });
});
