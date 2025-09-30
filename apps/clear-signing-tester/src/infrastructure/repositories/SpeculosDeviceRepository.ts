import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type DeviceRepository } from "../../domain/repositories/DeviceRepository";
import { TransactionInput } from "../../domain/models/TransactionInput";
import { TYPES } from "../../di/types";
import { SpeculosSigningService } from "../services/SpeculosSigningService";
import { TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { SigningFlowOrchestrator } from "../services/SigningFlowOrchestrator";
import { TestResult } from "@root/src/domain/types/TestStatus";

@injectable()
export class SpeculosDeviceRepository implements DeviceRepository {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.SigningFlowOrchestrator)
        private readonly orchestrator: SigningFlowOrchestrator,
        @inject(TYPES.SpeculosSigningService)
        private readonly signingService: SpeculosSigningService,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = loggerFactory("device-repository");
    }

    async performSignTransaction(
        transaction: TransactionInput,
        derivationPath: string,
    ): Promise<TestResult> {
        this.logger.debug("Performing sign transaction", {
            data: { derivationPath, transaction },
        });

        const signTransactionDA = this.signingService.signTransaction(
            derivationPath,
            transaction.rawTx,
        );

        return await this.orchestrator.orchestrateSigningFlow(
            signTransactionDA,
            transaction,
        );
    }

    async performSignTypedData(
        typedData: TypedDataInput,
        derivationPath: string,
    ): Promise<TestResult> {
        this.logger.debug("Performing sign typed data", {
            data: { derivationPath, typedData },
        });

        const signTypedDataDA = this.signingService.signTypedData(
            derivationPath,
            typedData.data,
        );

        return await this.orchestrator.orchestrateSigningFlow(
            signTypedDataDA,
            typedData,
        );
    }
}
