import { Container } from "inversify";
import { describe, expect, it, vi } from "vitest";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { networkTypes } from "@/shared/network/di/networkTypes";

import { instructionInfoModuleFactory } from "./instructionInfoModuleFactory";
import { instructionInfoTypes } from "./instructionInfoTypes";

describe("instructionInfoModuleFactory", () => {
  it("binds the data source as a singleton so its cache is shared", () => {
    const container = new Container();
    container.bind(configTypes.Config).toConstantValue({});
    container.bind(networkTypes.NetworkClient).toConstantValue({});
    container.bind(pkiTypes.PkiCertificateLoader).toConstantValue({});
    container
      .bind(configTypes.ContextModuleLoggerFactory)
      .toConstantValue(() => ({ debug: vi.fn(), warn: vi.fn() }));
    container.loadSync(instructionInfoModuleFactory());

    const first = container.get(instructionInfoTypes.InstructionInfoDataSource);
    const second = container.get(
      instructionInfoTypes.InstructionInfoDataSource,
    );
    expect(first).toBe(second);
  });
});
