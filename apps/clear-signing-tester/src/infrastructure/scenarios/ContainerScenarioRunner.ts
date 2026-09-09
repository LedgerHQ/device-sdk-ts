import { type Container } from "inversify";

import { type TestBatchContactFromFileUseCase } from "@root/src/application/usecases/TestBatchContactFromFileUseCase";
import { type TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { type TestBatchTypedDataFromFileUseCase } from "@root/src/application/usecases/TestBatchTypedDataFromFileUseCase";
import { type TestSolanaProgramUseCase } from "@root/src/application/usecases/TestSolanaProgramUseCase";
import { pinnedVersions } from "@root/src/cli/pinnedVersions";
import { makeEthereumContainer } from "@root/src/di/ethereumContainer";
import { type ClearSigningTesterConfig } from "@root/src/di/modules/configModuleFactory";
import { makeSolanaContainer } from "@root/src/di/solanaContainer";
import { TYPES } from "@root/src/di/types";
import { type CliLogLevel } from "@root/src/domain/models/config/LoggerConfig";
import { type ScenarioRun } from "@root/src/domain/models/Scenario";
import { type ScenarioOutcome } from "@root/src/domain/models/ScenarioOutcome";
import {
  SOLANA_SUPPORTED_PROGRAMS,
  type SolanaProgramName,
} from "@root/src/domain/models/SolanaProgramMap";
import { type ScenarioRunner } from "@root/src/domain/services/ScenarioRunner";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { type BatchTestResult } from "@root/src/domain/utils/ResultFormatter";
import { readAddressBookFile } from "@root/src/infrastructure/repositories/readAddressBookFile";

/** Settings that belong to the run as a whole, not to any one scenario. */
export type ScenarioRuntime = {
  readonly ethDerivationPath: string;
  readonly solanaDerivationPath: string;
  readonly logLevel: CliLogLevel;
  readonly fileLogLevel?: CliLogLevel;
  /** Directory for per-scenario log files; each scenario gets its own. */
  readonly logDir?: string;
  readonly screenshotPath?: string;
  readonly speculinhoUrl?: string;
  readonly speculosHttpTimeoutMs?: number;
  readonly solanaRpcUrl?: string;
  readonly scanLimit?: number;
  readonly samplesPerInstruction?: number;
  readonly originToken: string;
  /**
   * CAL mode. Injected ERC7730 descriptors are served with test certificates,
   * so a run using them must not verify against the production PKI root.
   */
  readonly calMode: "prod" | "test";
  /**
   * Overrides the default_versions.json pin for a one-off run. A scenario
   * carrying its own pin keeps it.
   */
  readonly osVersion?: string;
  readonly ethAppVersion?: string;
  readonly solanaAppVersion?: string;
};

const NO_COUNTS = {
  clearSigned: 0,
  partiallyClearSigned: 0,
  blindSigned: 0,
  error: 0,
} as const;

/**
 * Runs a scenario in its own container, so it gets its own emulator.
 *
 * A container per run is what makes scenarios parallelisable: every service is
 * singleton-scoped within a container, and the Speculinho config carries the
 * pod URL, so sharing one container would mean sharing one device.
 */
export class ContainerScenarioRunner implements ScenarioRunner {
  constructor(private readonly runtime: ScenarioRuntime) {}

  async run(run: ScenarioRun): Promise<ScenarioOutcome> {
    const startedAt = Date.now();
    const container = this.buildContainer(run);
    const services = container.get<ServiceController>(
      TYPES.MainServiceController,
    );

    try {
      await services.start();
      const result = await this.dispatch(container, run);
      return {
        run,
        counts: result.counts,
        failures: result.exitCode,
        failedCases: result.failedCases,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        run,
        counts: NO_COUNTS,
        // A scenario that never ran counts as one failure, not zero, so a
        // missing pod cannot make a run look green.
        failures: 1,
        failedCases: [],
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await services.stop().catch(() => undefined);
    }
  }

  private buildContainer({ scenario, device, slice }: ScenarioRun): Container {
    const pins = pinnedVersions(scenario.coinApp, device);
    const options = scenario.options ?? {};

    const config: ClearSigningTesterConfig = {
      speculinho: {
        device,
        ...(scenario.coinApp === "Solana" ? { appName: "Solana" } : {}),
        // A scenario that pins itself does so because the feature exists in no
        // other build, so its pin outranks a blanket --os-version meant for the
        // default. Otherwise a mixed run would drag it onto a build that
        // answers 6e00 to the very APDU it tests.
        osVersion:
          scenario.osVersion ?? this.runtime.osVersion ?? pins.osVersion,
        appVersion:
          scenario.appVersion ??
          (scenario.coinApp === "Solana"
            ? this.runtime.solanaAppVersion
            : this.runtime.ethAppVersion) ??
          pins.appVersion,
        screenshotPath: this.runtime.screenshotPath,
        speculinhoUrl: this.runtime.speculinhoUrl,
        speculosHttpTimeoutMs: this.runtime.speculosHttpTimeoutMs,
      },
      signer: {
        originToken: options.skipOriginToken ? "" : this.runtime.originToken,
        blindSigningEnabled: options.blindSigningEnabled ?? false,
        // withAddressBook() is build-time, so the book belongs to the signer
        // rather than to the batch that runs against it.
        ...(options.addressBook
          ? { addressBook: readAddressBookFile(options.addressBook) }
          : {}),
      },
      cal: {
        url: "https://global.api.prd.ledger.com/cal/v1",
        mode: this.runtime.calMode,
        branch: "main",
      },
      ...(this.runtime.solanaRpcUrl
        ? { solanaRpc: { url: this.runtime.solanaRpcUrl } }
        : {}),
    };

    const logger = {
      cli: { level: this.runtime.logLevel },
      ...(this.runtime.logDir
        ? {
            file: {
              level: this.runtime.fileLogLevel ?? this.runtime.logLevel,
              // One file per case, not per scenario: split cases run at the
              // same time, so a shared path interleaves them into a log that
              // cannot be read back for any single case.
              filePath:
                `${this.runtime.logDir}/${scenario.name.replace(/[:/ ]/g, "-")}-${device}` +
                `${slice ? `-case${slice.index}` : ""}.log`,
            },
          }
        : {}),
    };

    return scenario.coinApp === "Solana"
      ? makeSolanaContainer({ config, logger })
      : makeEthereumContainer({ config, logger });
  }

  private dispatch(
    container: Container,
    { scenario, slice }: ScenarioRun,
  ): Promise<BatchTestResult> {
    const { action, fixture, program, options } = scenario;
    const isSolana = scenario.coinApp === "Solana";

    switch (action) {
      case "signTransaction": {
        const token = isSolana
          ? TYPES.TestBatchSolanaTransactionFromFileUseCase
          : TYPES.TestBatchTransactionFromFileUseCase;
        return container
          .get<TestBatchTransactionFromFileUseCase>(token)
          .execute(fixture!, {
            defaultDerivationPath: isSolana
              ? this.runtime.solanaDerivationPath
              : this.runtime.ethDerivationPath,
            slice,
          });
      }
      case "signTypedData":
        return container
          .get<TestBatchTypedDataFromFileUseCase>(
            TYPES.TestBatchTypedDataFromFileUseCase,
          )
          .execute(fixture!, {
            defaultDerivationPath: this.runtime.ethDerivationPath,
            slice,
          });
      case "registerContact":
        return container
          .get<TestBatchContactFromFileUseCase>(
            TYPES.TestBatchContactFromFileUseCase,
          )
          .execute(fixture!);
      case "solanaProgram":
        return container
          .get<TestSolanaProgramUseCase>(TYPES.TestSolanaProgramUseCase)
          .execute({
            programId: SOLANA_SUPPORTED_PROGRAMS[program as SolanaProgramName],
            programName: program!,
            derivationPath: this.runtime.solanaDerivationPath,
            scanLimit: this.runtime.scanLimit,
            samplesPerInstruction: this.runtime.samplesPerInstruction,
            distill: options?.distill,
          });
    }
  }
}
