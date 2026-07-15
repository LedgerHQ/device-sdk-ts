import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { SolanaTransactionScanChainId } from "@/modules/solana/model/SolanaTransactionScanChainId";

import { HttpInstructionInfoDataSource } from "./HttpInstructionInfoDataSource";
import { type InstructionInfoDataSource } from "./InstructionInfoDataSource";
import { type CalInstructionInfoResponseDto } from "./InstructionInfoDto";

describe("HttpInstructionInfoDataSource", () => {
  let datasource: InstructionInfoDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  const programId = "11111111111111111111111111111111";
  const network = "solana-mainnet";
  const config: ContextModuleServiceConfig = {
    cal: {
      url: "https://crypto-assets-service.api.ledger.com/v1",
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
      "https://crypto-assets-service.api.ledger.com/v1/solana_programs",
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
      "https://crypto-assets-service.api.ledger.com/v1/solana_programs",
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
            instructionInfo: { data: "00010101", signature: "prodsig" },
            substructures: [],
            enumVariants: [],
            idlDescriptor: { typePool: [], rootType: 0 },
            mintAssociations: [],
            valueFlowPorts: [],
            accountResets: [],
            displayFields: [],
          }),
        },
        enumVariants: [],
      }),
    );
  });

  it("returns Left when the response array is empty", async () => {
    httpMock.get.mockResolvedValue([]);

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result).toEqual(
      Left(
        new Error(
          `[ContextModule] HttpInstructionInfoDataSource: empty response for program ${programId}`,
        ),
      ),
    );
  });

  it("returns Left when no program object matches the requested programId", async () => {
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
        new Error(
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
  });
});
