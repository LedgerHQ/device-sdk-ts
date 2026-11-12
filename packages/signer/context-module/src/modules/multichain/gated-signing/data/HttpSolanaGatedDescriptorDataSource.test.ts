import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpSolanaGatedDescriptorDataSource } from "./HttpSolanaGatedDescriptorDataSource";

describe("HttpSolanaGatedDescriptorDataSource", () => {
  const config = {
    cal: {
      url: "https://crypto-assets-service.api.ledger.com/v1",
      branch: "main",
      mode: "prod",
    },
  } as ContextModuleServiceConfig;

  const programId = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
  const routeHex = "e517cb977ae3ad2a";
  const routeDescriptor = "0101aa";
  const programDescriptor = "0101bb";

  // Same entry shape as Ethereum: the selector holds the discriminator.
  const entry = (selector: string | undefined, descriptor: string) => ({
    network: "solana",
    chain_id: 900,
    address: programId,
    version: "v1",
    ...(selector === undefined ? {} : { selector }),
    descriptor,
    signatures: { prod: "abcd", test: "0000" },
  });

  const mockLoggerFactory = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  });

  let httpMock: { get: ReturnType<typeof vi.fn> };
  let dataSource: HttpSolanaGatedDescriptorDataSource;

  beforeEach(() => {
    vi.resetAllMocks();
    httpMock = { get: vi.fn() };
    dataSource = new HttpSolanaGatedDescriptorDataSource(
      config,
      mockLoggerFactory,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("queries CAL gated dapps for the program on Solana mainnet", async () => {
    httpMock.get.mockResolvedValue([]);

    await dataSource.getGatedDescriptors({ programId });

    expect(httpMock.get).toHaveBeenCalledWith(
      "https://crypto-assets-service.api.ledger.com/v1/gated_dapps",
      {
        params: {
          ref: "branch:main",
          output: "gated_descriptors",
          contracts: programId,
          chain_id: 900,
        },
      },
    );
  });

  it("returns program-only and program-and-instruction descriptors, signed", async () => {
    httpMock.get.mockResolvedValue([
      {
        gated_descriptors: {
          [programId]: {
            [routeHex]: entry(routeHex, routeDescriptor),
            "": entry("", programDescriptor),
          },
        },
      },
    ]);

    const result = await dataSource.getGatedDescriptors({ programId });

    // signedDescriptor = descriptor + SIGNATURE_TAG (15) + length (02) + signature
    expect(result.extract()).toEqual([
      {
        programId,
        discriminator: new Uint8Array([
          0xe5, 0x17, 0xcb, 0x97, 0x7a, 0xe3, 0xad, 0x2a,
        ]),
        signedDescriptor: `${routeDescriptor}1502abcd`,
      },
      {
        programId,
        discriminator: new Uint8Array(),
        signedDescriptor: `${programDescriptor}1502abcd`,
      },
    ]);
  });

  it("skips an entry without a selector instead of treating it as program only", async () => {
    httpMock.get.mockResolvedValue([
      {
        gated_descriptors: {
          [programId]: {
            any: entry(undefined, programDescriptor),
            [routeHex]: entry(routeHex, routeDescriptor),
          },
        },
      },
    ]);

    const result = await dataSource.getGatedDescriptors({ programId });

    expect(result.extract()).toEqual([
      expect.objectContaining({
        signedDescriptor: `${routeDescriptor}1502abcd`,
      }),
    ]);
  });

  it("returns an empty list when the program is not gated", async () => {
    httpMock.get.mockResolvedValue([
      { gated_descriptors: { OtherProgram: { "": entry("", "00") } } },
    ]);

    const result = await dataSource.getGatedDescriptors({ programId });

    expect(result.extract()).toEqual([]);
  });

  it.each([
    ["odd length", "e517c"],
    ["not hex", "zz"],
    ["longer than 8 bytes", "e517cb977ae3ad2a00"],
  ])("skips an entry with a bad discriminator (%s)", async (_, bad) => {
    httpMock.get.mockResolvedValue([
      {
        gated_descriptors: {
          [programId]: {
            [bad]: entry(bad, "00"),
            [routeHex]: entry(routeHex, routeDescriptor),
          },
        },
      },
    ]);

    const result = await dataSource.getGatedDescriptors({ programId });

    expect(result.extract()).toEqual([
      expect.objectContaining({
        signedDescriptor: `${routeDescriptor}1502abcd`,
      }),
    ]);
  });

  it("skips an entry without a signature for the configured mode", async () => {
    httpMock.get.mockResolvedValue([
      {
        gated_descriptors: {
          [programId]: {
            [routeHex]: {
              selector: routeHex,
              descriptor: routeDescriptor,
              signatures: { test: "0000" },
            },
          },
        },
      },
    ]);

    const result = await dataSource.getGatedDescriptors({ programId });

    expect(result.extract()).toEqual([]);
  });

  it.each([
    ["a null selector", { selector: null, descriptor: "00" }],
    ["no descriptor", { selector: routeHex }],
    [
      "a non-string signature",
      { selector: "", descriptor: "00", signatures: { prod: 1 } },
    ],
  ])(
    "skips an entry with %s and keeps the valid ones",
    async (_, malformed) => {
      httpMock.get.mockResolvedValue([
        {
          gated_descriptors: {
            [programId]: {
              bad: malformed,
              [routeHex]: entry(routeHex, routeDescriptor),
            },
          },
        },
      ]);

      const result = await dataSource.getGatedDescriptors({ programId });

      expect(result.extract()).toEqual([
        expect.objectContaining({
          signedDescriptor: `${routeDescriptor}1502abcd`,
        }),
      ]);
    },
  );

  it("returns an error when the request fails", async () => {
    httpMock.get.mockRejectedValue(new Error("network down"));

    const result = await dataSource.getGatedDescriptors({ programId });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toContain("network down");
  });

  it("returns an error when the response is malformed", async () => {
    httpMock.get.mockResolvedValue({ gated_descriptors: {} });

    const result = await dataSource.getGatedDescriptors({ programId });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toContain(
      "Invalid gated descriptors response",
    );
  });
});
