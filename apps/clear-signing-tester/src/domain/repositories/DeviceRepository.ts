import { TypedDataInput } from "../models/TypedDataInput";
import { TransactionInput } from "../models/TransactionInput";
import { TestResult } from "../types/TestStatus";

export interface DeviceRepository {
    performSignTransaction(
        transaction: TransactionInput,
        derivationPath: string,
    ): Promise<TestResult>;
    performSignTypedData(
        typedData: TypedDataInput,
        derivationPath: string,
    ): Promise<TestResult>;
}
