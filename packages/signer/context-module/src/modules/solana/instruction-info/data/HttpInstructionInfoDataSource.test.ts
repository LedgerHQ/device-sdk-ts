import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { SolanaTransactionScanChainId } from "@/modules/solana/model/SolanaTransactionScanChainId";

import { HttpInstructionInfoDataSource } from "./HttpInstructionInfoDataSource";
import {
  type InstructionInfoDataSource,
  SolanaProgramNotFoundError,
} from "./InstructionInfoDataSource";
import { type CalInstructionInfoResponseDto } from "./InstructionInfoDto";

describe("HttpInstructionInfoDataSource", () => {
  let datasource: InstructionInfoDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  const programId = "11111111111111111111111111111111";
  const network = "solana-mainnet";
  const config: ContextModuleServiceConfig = {
    cal: {
      url: "https://global.api.prd.ledger.com/cal/v1",
      mode: "prod",
      branch: "main",
    },
  } as ContextModuleServiceConfig;

  const successResponse: CalInstructionInfoResponseDto = [
    {
      id: programId,
      chain_id: SolanaTransactionScanChainId.MAINNET,
      instructions: [
        {
          discriminator_hex: "00000000",
          instruction_name: "createAccount",
          descriptor: {
            data: "00010101",
            signatures: { prod: "prodsig", test: "testsig" },
          },
          display_fields: [],
          value_flow_ports: [],
          hide_rules: [],
          account_resets: [],
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpInstructionInfoDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("calls CAL /solana_programs with id, chain_id and output params", async () => {
    httpMock.get.mockResolvedValue(successResponse);

    await datasource.getInstructionInfo({ programId, network });

    expect(httpMock.get).toHaveBeenCalledTimes(1);
    expect(httpMock.get).toHaveBeenCalledWith(
      "https://global.api.prd.ledger.com/cal/v1/solana_programs",
      {
        params: {
          id: programId,
          chain_id: SolanaTransactionScanChainId.MAINNET,
          output: "id,chain_id,instructions",
          ref: "branch:main",
        },
      },
    );
  });

  it("maps devnet/testnet networks to their numeric chain ids", async () => {
    httpMock.get.mockResolvedValue(successResponse);

    await datasource.getInstructionInfo({
      programId,
      network: "solana-devnet",
    });

    expect(httpMock.get).toHaveBeenCalledWith(
      "https://global.api.prd.ledger.com/cal/v1/solana_programs",
      expect.objectContaining({
        params: expect.objectContaining({ chain_id: 901 }),
      }),
    );
  });

  it("returns Right with each descriptor transformed into the core payload on success", async () => {
    httpMock.get.mockResolvedValue(successResponse);

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result).toEqual(
      Right({
        programId,
        descriptors: {
          "00000000": Right({
            programId,
            discriminator: "00000000",
            instructionName: "createAccount",
            instructionInfo: { data: "00010101", signature: "prodsig" },
            substructures: [],
            enumVariants: [],
            idlDescriptor: { typePool: [], rootType: 0 },
            mintAssociations: [],
            ownerAssociations: [],
            valueFlowPorts: [],
            accountResets: [],
            displayFields: [],
            hideRules: [],
          }),
        },
        enumVariants: [],
        basicFlowTags: [],
      }),
    );
  });

  it("keys a descriptor without `discriminator_hex` under the empty string", async () => {
    // Single-instruction programs (e.g. SPL Memo `addMemo`) genuinely have no
    // discriminator, so CAL omits the field.
    httpMock.get.mockResolvedValue([
      {
        id: programId,
        chain_id: SolanaTransactionScanChainId.MAINNET,
        instructions: [
          {
            instruction_name: "addMemo",
            descriptor: {
              data: "00010101",
              signatures: { prod: "prodsig", test: "testsig" },
            },
          },
        ],
      },
    ]);

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result.isRight()).toBe(true);
    const { descriptors } = result.unsafeCoerce();
    expect(Object.keys(descriptors)).toEqual([""]);
    expect(descriptors[""]!.unsafeCoerce()).toEqual(
      expect.objectContaining({
        programId,
        discriminator: "",
        instructionInfo: { data: "00010101", signature: "prodsig" },
      }),
    );
  });

  it("returns a SolanaProgramNotFoundError when the response array is empty", async () => {
    httpMock.get.mockResolvedValue([]);

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result).toEqual(
      Left(
        new SolanaProgramNotFoundError(
          programId,
          `[ContextModule] HttpInstructionInfoDataSource: empty response for program ${programId}`,
        ),
      ),
    );
    expect(result.extract()).toBeInstanceOf(SolanaProgramNotFoundError);
  });

  it("returns a plain Error, not a not-found, when the response is not an array", async () => {
    httpMock.get.mockResolvedValue({ unexpected: true });

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result.isLeft()).toBe(true);
    expect(result.extract()).not.toBeInstanceOf(SolanaProgramNotFoundError);
    expect((result.extract() as Error).message).toBe(
      `[ContextModule] HttpInstructionInfoDataSource: unexpected response for program ${programId}`,
    );
  });

  it("returns a SolanaProgramNotFoundError when no program object matches the requested programId", async () => {
    httpMock.get.mockResolvedValue([
      {
        id: "OtherProgram",
        chain_id: SolanaTransactionScanChainId.MAINNET,
        instructions: [],
      },
    ]);

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result).toEqual(
      Left(
        new SolanaProgramNotFoundError(
          programId,
          `[ContextModule] HttpInstructionInfoDataSource: no descriptors for program ${programId}`,
        ),
      ),
    );
  });

  it("returns Left (not a throw) when an instruction descriptor is malformed", async () => {
    // `descriptor` missing on the instruction — would crash the loader if the
    // datasource handed it through unvalidated.
    httpMock.get.mockResolvedValue([
      {
        id: programId,
        chain_id: SolanaTransactionScanChainId.MAINNET,
        instructions: [{ discriminator_hex: "00000000" }],
      },
    ]);

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toMatch(
      new RegExp(
        String.raw`\[ContextModule\] HttpInstructionInfoDataSource: malformed descriptors for program ${programId}:`,
      ),
    );
  });

  it("returns Left (not a throw) when account_schema.slots is not an array", async () => {
    // Regression: account_schema was not codec-validated, so a malformed
    // shape (e.g. `slots` as an object instead of an array) bypassed
    // validation here and crashed later in the mapper's `.map()` call instead
    // of degrading gracefully to a per-program error.
    httpMock.get.mockResolvedValue([
      {
        id: programId,
        chain_id: SolanaTransactionScanChainId.MAINNET,
        instructions: [
          {
            discriminator_hex: "00000000",
            descriptor: {
              data: "00010101",
              signatures: { prod: "prodsig", test: "testsig" },
            },
            account_schema: { slots: {} },
          },
        ],
      },
    ]);

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toMatch(
      new RegExp(
        String.raw`\[ContextModule\] HttpInstructionInfoDataSource: malformed descriptors for program ${programId}:`,
      ),
    );
  });

  it("returns Right with accountSchema mapped through when it is well-formed", async () => {
    httpMock.get.mockResolvedValue([
      {
        id: programId,
        chain_id: SolanaTransactionScanChainId.MAINNET,
        instructions: [
          {
            discriminator_hex: "00000000",
            descriptor: {
              data: "00010101",
              signatures: { prod: "prodsig", test: "testsig" },
            },
            account_schema: {
              count_min: 2,
              count_max: 2,
              slots: [{ signer: "REQUIRED", writable: "EITHER" }],
            },
          },
        ],
      },
    ]);

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result.isRight()).toBe(true);
    const { descriptors } = result.unsafeCoerce();
    expect(descriptors["00000000"]!.unsafeCoerce()).toEqual(
      expect.objectContaining({
        accountSchema: {
          count_min: 2,
          count_max: 2,
          remaining_policy: { signer: "EITHER", writable: "EITHER" },
          slots: [{ signer: "REQUIRED", writable: "EITHER" }],
        },
      }),
    );
  });

  it("returns Left when the HTTP client throws", async () => {
    httpMock.get.mockRejectedValue(new Error("network"));

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpInstructionInfoDataSource: Failed to fetch instruction descriptors: network",
        ),
      ),
    );
    expect(result.extract()).not.toBeInstanceOf(SolanaProgramNotFoundError);
  });

  describe("signing_route", () => {
    const stakeProgramId = "Stake11111111111111111111111111111111111111";
    const signedDescriptor = {
      data: "00010101",
      signatures: { prod: "prodsig", test: "testsig" },
    };

    // Agreed CAL contract: `signing_route` sits on each instruction object,
    // outside the signed `descriptor`.
    const stakeResponse = (
      signingRoutes: Record<string, unknown>,
    ): CalInstructionInfoResponseDto =>
      [
        {
          id: stakeProgramId,
          chain_id: SolanaTransactionScanChainId.MAINNET,
          instructions: Object.entries(signingRoutes).map(
            ([discriminator_hex, signing_route]) => ({
              discriminator_hex,
              descriptor: signedDescriptor,
              ...(signing_route === undefined ? {} : { signing_route }),
            }),
          ),
        },
      ] as CalInstructionInfoResponseDto;

    const getStakeInfo = () =>
      datasource.getInstructionInfo({ programId: stakeProgramId, network });

    it("maps basic_flow tags to one entry per (discriminator, rule, role)", async () => {
      httpMock.get.mockResolvedValue(
        stakeResponse({
          "00000000": {
            basic_flow: [{ rule: "native-staking", role: "allowed" }],
          },
          "02000000": {
            basic_flow: [
              { rule: "native-staking", role: "required" },
              { rule: "other-rule", role: "allowed" },
            ],
          },
        }),
      );

      const result = await getStakeInfo();

      expect(result.unsafeCoerce().basicFlowTags).toEqual([
        { discriminator: "00000000", rule: "native-staking", role: "allowed" },
        {
          discriminator: "02000000",
          rule: "native-staking",
          role: "required",
        },
        { discriminator: "02000000", rule: "other-rule", role: "allowed" },
      ]);
    });

    it("returns no tags when CAL doesn't serve signing_route (today's CAL)", async () => {
      httpMock.get.mockResolvedValue(
        stakeResponse({ "00000000": undefined, "02000000": undefined }),
      );

      const result = await getStakeInfo();

      expect(result.unsafeCoerce().basicFlowTags).toEqual([]);
    });

    it("drops unknown roles, empty rule ids and unknown keys", async () => {
      httpMock.get.mockResolvedValue(
        stakeResponse({
          "02000000": {
            basic_flow: [
              { rule: "native-staking", role: "forbidden" },
              { rule: "", role: "required" },
              { rule: "native-staking", role: "required", extra: 1 },
            ],
            other_flow: [{ rule: "x", role: "required" }],
          },
        }),
      );

      const result = await getStakeInfo();

      expect(result.unsafeCoerce().basicFlowTags).toEqual([
        {
          discriminator: "02000000",
          rule: "native-staking",
          role: "required",
        },
      ]);
    });

    it.each([
      ["a string", "native-staking"],
      ["basic_flow not an array", { basic_flow: { rule: "a" } }],
      ["an entry without role", { basic_flow: [{ rule: "native-staking" }] }],
      ["a non-string rule", { basic_flow: [{ rule: 1, role: "required" }] }],
    ])(
      "drops a malformed signing_route (%s) but keeps the descriptors",
      async (_, signingRoute) => {
        httpMock.get.mockResolvedValue(
          stakeResponse({
            "00000000": {
              basic_flow: [{ rule: "native-staking", role: "allowed" }],
            },
            "02000000": signingRoute,
          }),
        );

        const result = await getStakeInfo();

        expect(result.isRight()).toBe(true);
        const { descriptors, basicFlowTags } = result.unsafeCoerce();
        expect(Object.keys(descriptors)).toEqual(["00000000", "02000000"]);
        expect(descriptors["02000000"]!.isRight()).toBe(true);
        expect(basicFlowTags).toEqual([
          {
            discriminator: "00000000",
            rule: "native-staking",
            role: "allowed",
          },
        ]);
      },
    );

    it("ignores tags on an instruction without discriminator_hex", async () => {
      httpMock.get.mockResolvedValue([
        {
          id: stakeProgramId,
          chain_id: SolanaTransactionScanChainId.MAINNET,
          instructions: [
            {
              descriptor: signedDescriptor,
              signing_route: {
                basic_flow: [{ rule: "native-staking", role: "required" }],
              },
            },
          ],
        },
      ]);

      const result = await getStakeInfo();

      expect(result.unsafeCoerce().basicFlowTags).toEqual([]);
    });
  });

  describe("cache", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("serves a second call for the same program and network from the cache", async () => {
      httpMock.get.mockResolvedValue(successResponse);

      const first = await datasource.getInstructionInfo({ programId, network });
      const second = await datasource.getInstructionInfo({
        programId,
        network,
      });

      expect(httpMock.get).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    });

    it("shares one HTTP call between concurrent callers", async () => {
      httpMock.get.mockResolvedValue(successResponse);

      await Promise.all([
        datasource.getInstructionInfo({ programId, network }),
        datasource.getInstructionInfo({ programId, network }),
      ]);

      expect(httpMock.get).toHaveBeenCalledTimes(1);
    });

    it("keys the cache by chain id", async () => {
      httpMock.get.mockResolvedValue(successResponse);

      await datasource.getInstructionInfo({ programId, network });
      await datasource.getInstructionInfo({
        programId,
        network: "solana-devnet",
      });
      // Unknown labels fall back to mainnet, so they share its entry.
      await datasource.getInstructionInfo({ programId, network: "unknown" });

      expect(httpMock.get).toHaveBeenCalledTimes(2);
    });

    it("fetches again once the entry has expired", async () => {
      httpMock.get.mockResolvedValue(successResponse);

      await datasource.getInstructionInfo({ programId, network });
      vi.advanceTimersByTime(30_001);
      await datasource.getInstructionInfo({ programId, network });

      expect(httpMock.get).toHaveBeenCalledTimes(2);
    });

    it("evicts the oldest entry beyond the size cap", async () => {
      httpMock.get.mockImplementation(
        (_url: string, { params }: { params: { id: string } }) =>
          Promise.resolve([
            { ...successResponse[0]!, id: params.id },
          ] as CalInstructionInfoResponseDto),
      );
      const ids = Array.from({ length: 65 }, (_, i) => `program-${i}`);

      for (const id of ids) {
        await datasource.getInstructionInfo({ programId: id, network });
      }
      // The most recent entry is still cached, the oldest was evicted.
      await datasource.getInstructionInfo({ programId: ids[64]!, network });
      expect(httpMock.get).toHaveBeenCalledTimes(65);
      await datasource.getInstructionInfo({ programId: ids[0]!, network });
      expect(httpMock.get).toHaveBeenCalledTimes(66);
    });

    it.each([
      ["the HTTP client throws", () => Promise.reject(new Error("network"))],
      [
        "the program is malformed",
        () =>
          Promise.resolve([
            { id: programId, chain_id: 900, instructions: [{}] },
          ]),
      ],
    ])("does not cache a failure (%s)", async (_, failingGet) => {
      httpMock.get
        .mockImplementationOnce(failingGet)
        .mockResolvedValue(successResponse);

      const first = await datasource.getInstructionInfo({ programId, network });
      const second = await datasource.getInstructionInfo({
        programId,
        network,
      });

      expect(first.isLeft()).toBe(true);
      expect(second.isRight()).toBe(true);
      expect(httpMock.get).toHaveBeenCalledTimes(2);
    });

    it("caches a program-not-found answer", async () => {
      httpMock.get.mockResolvedValue([]);

      await datasource.getInstructionInfo({ programId, network });
      const second = await datasource.getInstructionInfo({
        programId,
        network,
      });

      expect(second.extract()).toBeInstanceOf(SolanaProgramNotFoundError);
      expect(httpMock.get).toHaveBeenCalledTimes(1);
    });
  });
});
