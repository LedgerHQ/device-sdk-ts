import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import {
  type SolanaGatedDescriptor,
  type SolanaGatedDescriptorDataSource,
} from "@/modules/multichain/gated-signing/data/SolanaGatedDescriptorDataSource";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import {
  type SolanaGatedSigningContextInput,
  SolanaGatedSigningContextLoader,
} from "./SolanaGatedSigningContextLoader";

const PARTNER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const SYSTEM = "11111111111111111111111111111111";
const ROUTE = new Uint8Array([0xe5, 0x17, 0xcb, 0x97, 0x7a, 0xe3, 0xad, 0x2a]);
const TRANSFER = new Uint8Array([2, 0, 0, 0]);

describe("SolanaGatedSigningContextLoader", () => {
  const dataSource: SolanaGatedDescriptorDataSource = {
    getGatedDescriptors: vi.fn(),
  };
  const certificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };
  const mockLoggerFactory = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  });
  const certificate: PkiCertificate = {
    keyUsageNumber: 13,
    payload: new Uint8Array([0x01, 0x02]),
  };

  const loader = new SolanaGatedSigningContextLoader(
    dataSource,
    certificateLoader,
    mockLoggerFactory,
  );

  const input: SolanaGatedSigningContextInput = {
    deviceModelId: DeviceModelId.FLEX,
    gatedSigning: {
      instructions: [
        { programId: SYSTEM, data: TRANSFER },
        { programId: PARTNER, data: ROUTE },
      ],
    },
  };

  const routeDescriptor: SolanaGatedDescriptor = {
    programId: PARTNER,
    discriminator: ROUTE,
    signedDescriptor: "aa15020000",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(certificateLoader.loadCertificate).mockResolvedValue(certificate);
  });

  describe("canHandle", () => {
    const types = [ClearSignContextType.SOLANA_GATED_SIGNING];

    it("accepts top-level instructions", () => {
      expect(loader.canHandle(input, types)).toBe(true);
    });

    it("rejects other context types", () => {
      expect(
        loader.canHandle(input, [ClearSignContextType.SOLANA_TRUSTED_NAME]),
      ).toBe(false);
    });

    it.each([
      ["no instructions", { ...input, gatedSigning: { instructions: [] } }],
      ["no gatedSigning", { deviceModelId: DeviceModelId.FLEX }],
      [
        "data that is not bytes",
        {
          ...input,
          gatedSigning: { instructions: [{ programId: PARTNER, data: "00" }] },
        },
      ],
      ["unsupported device", { ...input, deviceModelId: DeviceModelId.NANO_S }],
    ])("rejects %s", (_, candidate) => {
      expect(loader.canHandle(candidate, types)).toBe(false);
    });
  });

  describe("load", () => {
    it("fetches each program once", async () => {
      vi.mocked(dataSource.getGatedDescriptors).mockResolvedValue(Right([]));

      await loader.load({
        ...input,
        gatedSigning: {
          instructions: [
            { programId: SYSTEM, data: TRANSFER },
            { programId: SYSTEM, data: TRANSFER },
            { programId: PARTNER, data: ROUTE },
          ],
        },
      });

      expect(dataSource.getGatedDescriptors).toHaveBeenCalledTimes(2);
      expect(dataSource.getGatedDescriptors).toHaveBeenCalledWith({
        programId: SYSTEM,
      });
      expect(dataSource.getGatedDescriptors).toHaveBeenCalledWith({
        programId: PARTNER,
      });
    });

    it("returns the matching descriptor with the gated-signing certificate", async () => {
      vi.mocked(dataSource.getGatedDescriptors).mockImplementation(
        ({ programId }) =>
          Promise.resolve(
            Right(programId === PARTNER ? [routeDescriptor] : []),
          ),
      );

      const result = await loader.load(input);

      expect(certificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.CalGatedSigning,
        keyUsage: KeyUsage.GatedSigning,
        targetDevice: DeviceModelId.FLEX,
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.SOLANA_GATED_SIGNING,
          payload: "aa15020000",
          certificate,
        },
      ]);
    });

    it("returns nothing when no instruction matches", async () => {
      vi.mocked(dataSource.getGatedDescriptors).mockImplementation(
        ({ programId }) =>
          Promise.resolve(
            Right(
              programId === PARTNER
                ? [{ ...routeDescriptor, discriminator: new Uint8Array([1]) }]
                : [],
            ),
          ),
      );

      const result = await loader.load(input);

      expect(result).toEqual([]);
      expect(certificateLoader.loadCertificate).not.toHaveBeenCalled();
    });

    it("still matches when another program's lookup fails", async () => {
      vi.mocked(dataSource.getGatedDescriptors).mockImplementation(
        ({ programId }) =>
          Promise.resolve(
            programId === PARTNER
              ? Right([routeDescriptor])
              : Left(new Error("CAL down")),
          ),
      );

      const result = await loader.load(input);

      expect(result).toEqual([
        expect.objectContaining({
          type: ClearSignContextType.SOLANA_GATED_SIGNING,
        }),
      ]);
    });

    it("returns an error when nothing matched and a lookup failed", async () => {
      const error = new Error("CAL down");
      vi.mocked(dataSource.getGatedDescriptors).mockResolvedValue(Left(error));

      const result = await loader.load(input);

      expect(result).toEqual([{ type: ClearSignContextType.ERROR, error }]);
    });
  });
});
