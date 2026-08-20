import { DeviceModelId } from "@ledgerhq/device-management-kit";

import {
  type ContactDecoration,
  type ContactLedgerAccountDecoration,
  type ContactsDataSource,
} from "@/modules/ethereum/contacts/domain/ContactsDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { ContactsContextLoader } from "./ContactsContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

const fromDecoration: ContactLedgerAccountDecoration = {
  accountName: "from-account",
  hmacProofHex: "aa".repeat(32),
  derivationPath: "44'/60'/0'/0/0",
  chainId: 1,
};

const toLedgerDecoration: ContactDecoration = {
  kind: "ledgerAccount",
  accountName: "to-account",
  hmacProofHex: "bb".repeat(32),
  derivationPath: "44'/60'/0'/0/1",
  chainId: 1,
};

const toExternalDecoration: ContactDecoration = {
  kind: "external",
  contactName: "Alice",
  scope: "default",
  addressHex: "0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd",
  groupHandleHex: "cc".repeat(32),
  hmacNameHex: "dd".repeat(32),
  hmacRestHex: "ee".repeat(32),
  derivationPath: "",
  chainId: 1,
};

const validInput = {
  chainId: 1,
  from: "0x1111111111111111111111111111111111111111",
  to: "0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd",
  deviceModelId: DeviceModelId.STAX,
};

const buildDataSource = (
  overrides: Partial<ContactsDataSource> = {},
): ContactsDataSource => ({
  lookupFrom: vi.fn().mockResolvedValue(null),
  lookupTo: vi.fn().mockResolvedValue(null),
  ...overrides,
});

describe("ContactsContextLoader", () => {
  describe("canHandle", () => {
    const loader = new ContactsContextLoader(
      buildDataSource(),
      mockLoggerFactory,
    );

    it("returns true when both addresses + chainId + deviceModelId are present", () => {
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL,
          ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT,
        ]),
      ).toBe(true);
    });

    it("returns true when only `from` is present", () => {
      expect(
        loader.canHandle(
          {
            chainId: 1,
            from: validInput.from,
            deviceModelId: DeviceModelId.STAX,
          },
          [ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT],
        ),
      ).toBe(true);
    });

    it("returns true when only `to` is present", () => {
      expect(
        loader.canHandle(
          { chainId: 1, to: validInput.to, deviceModelId: DeviceModelId.STAX },
          [ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL],
        ),
      ).toBe(true);
    });

    it("returns false when neither `from` nor `to` is a valid hex address", () => {
      expect(
        loader.canHandle({ chainId: 1, deviceModelId: DeviceModelId.STAX }, [
          ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL,
        ]),
      ).toBe(false);
    });

    it("returns false when expectedTypes lists no CONTACT_* variant", () => {
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.ETHEREUM_TRUSTED_NAME,
        ]),
      ).toBe(false);
    });

    it.each([null, undefined, "string", 123, {}])(
      "returns false for invalid input %p",
      (input) => {
        expect(
          loader.canHandle(input, [
            ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL,
          ]),
        ).toBe(false);
      },
    );
  });

  describe("load", () => {
    it("emits nothing when no addresses match", async () => {
      const loader = new ContactsContextLoader(
        buildDataSource(),
        mockLoggerFactory,
      );
      expect(await loader.load(validInput)).toEqual([]);
    });

    it("emits CONTACT_LEDGER_ACCOUNT for a from-side match", async () => {
      const ds = buildDataSource({
        lookupFrom: vi.fn().mockResolvedValue(fromDecoration),
      });
      const loader = new ContactsContextLoader(ds, mockLoggerFactory);

      const contexts = await loader.load(validInput);

      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toEqual({
        type: ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT,
        payload: "",
        decoration: fromDecoration,
        address: validInput.from,
      });
    });

    it("emits CONTACT_EXTERNAL for an external to-side match", async () => {
      const ds = buildDataSource({
        lookupTo: vi.fn().mockResolvedValue(toExternalDecoration),
      });
      const loader = new ContactsContextLoader(ds, mockLoggerFactory);

      const contexts = await loader.load(validInput);

      expect(contexts).toHaveLength(1);
      expect(contexts[0]?.type).toBe(
        ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL,
      );
      const { kind: _kind, ...rest } = toExternalDecoration;
      expect(contexts[0]).toMatchObject({
        decoration: rest,
        address: validInput.to,
      });
    });

    it("emits CONTACT_LEDGER_ACCOUNT for a self-send (to-side Ledger account) match", async () => {
      const ds = buildDataSource({
        lookupTo: vi.fn().mockResolvedValue(toLedgerDecoration),
      });
      const loader = new ContactsContextLoader(ds, mockLoggerFactory);

      const contexts = await loader.load(validInput);

      expect(contexts).toHaveLength(1);
      expect(contexts[0]?.type).toBe(
        ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT,
      );
    });

    it("emits both from + to contexts when both sides match", async () => {
      const ds = buildDataSource({
        lookupFrom: vi.fn().mockResolvedValue(fromDecoration),
        lookupTo: vi.fn().mockResolvedValue(toExternalDecoration),
      });
      const loader = new ContactsContextLoader(ds, mockLoggerFactory);

      const contexts = await loader.load(validInput);

      expect(contexts.map((c) => c.type)).toEqual([
        ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT,
        ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL,
      ]);
    });

    it("swallows data-source errors and returns the partial result", async () => {
      const ds = buildDataSource({
        lookupFrom: vi.fn().mockRejectedValue(new Error("boom")),
        lookupTo: vi.fn().mockResolvedValue(toExternalDecoration),
      });
      const loader = new ContactsContextLoader(ds, mockLoggerFactory);

      const contexts = await loader.load(validInput);

      expect(contexts).toHaveLength(1);
      expect(contexts[0]?.type).toBe(
        ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL,
      );
    });

    it("strips a leading m/ from derivationPath on every emitted decoration", async () => {
      const ds = buildDataSource({
        lookupFrom: vi.fn().mockResolvedValue({
          ...fromDecoration,
          derivationPath: "m/44'/60'/0'/0/0",
        }),
        lookupTo: vi.fn().mockResolvedValue({
          ...toExternalDecoration,
          derivationPath: "M/44'/60'/0'/0/5",
        }),
      });
      const loader = new ContactsContextLoader(ds, mockLoggerFactory);

      const contexts = await loader.load(validInput);

      expect(contexts).toHaveLength(2);
      expect(
        (contexts[0] as { decoration: { derivationPath: string } }).decoration
          .derivationPath,
      ).toBe("44'/60'/0'/0/0");
      expect(
        (contexts[1] as { decoration: { derivationPath: string } }).decoration
          .derivationPath,
      ).toBe("44'/60'/0'/0/5");
    });

    it("skips lookup for missing or invalid addresses", async () => {
      const lookupFrom = vi.fn().mockResolvedValue(null);
      const lookupTo = vi.fn().mockResolvedValue(null);
      const ds = buildDataSource({ lookupFrom, lookupTo });
      const loader = new ContactsContextLoader(ds, mockLoggerFactory);

      await loader.load({
        chainId: 1,
        to: validInput.to,
        deviceModelId: DeviceModelId.STAX,
      });

      expect(lookupFrom).not.toHaveBeenCalled();
      expect(lookupTo).toHaveBeenCalledWith({
        address: validInput.to,
        chainId: 1,
      });
    });
  });
});
