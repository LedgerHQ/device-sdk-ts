import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

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
      descriptors_instruction: {
        [programId]: {
          "00000000": {
            type: "instruction",
            network: "solana-mainnet",
            version: "v1",
            instruction_info: {
              version: 1,
              program_id: programId,
              discriminator: "00000000",
              hash: "deadbeef",
              descriptor: {
                data: "00010101",
                signatures: { prod: "prodsig", test: "testsig" },
              },
            },
            display_fields: [],
            value_flow_ports: [],
            hide_rules: [],
            account_resets: [],
          },
        },
      },
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

  it("calls CAL with singular program= and ref=branch:<branch>", async () => {
    httpMock.get.mockResolvedValue(successResponse);

    await datasource.getInstructionInfo({ programId, network });

    expect(httpMock.get).toHaveBeenCalledTimes(1);
    expect(httpMock.get).toHaveBeenCalledWith(
      "https://crypto-assets-service.api.ledger.com/v1/solana",
      {
        params: {
          output: "descriptors_instruction",
          network,
          program: programId,
          ref: "branch:main",
        },
      },
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

  it("returns Left when the envelope is malformed", async () => {
    httpMock.get.mockResolvedValue([{ foo: "bar" }]);

    const result = await datasource.getInstructionInfo({ programId, network });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toMatch(
      new RegExp(
        String.raw`\[ContextModule\] HttpInstructionInfoDataSource: malformed response for program ${programId}:`,
      ),
    );
  });

  it("returns Left when the response doesn't contain the requested programId", async () => {
    httpMock.get.mockResolvedValue([
      { descriptors_instruction: { OtherProgram: {} } },
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

  it("returns Left (not a throw) when an inner descriptor is malformed", async () => {
    // `instruction_info.descriptor` missing — would crash the loader if the
    // datasource handed it through unvalidated.
    httpMock.get.mockResolvedValue([
      {
        descriptors_instruction: {
          [programId]: {
            "00000000": { type: "instruction", instruction_info: {} },
          },
        },
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
