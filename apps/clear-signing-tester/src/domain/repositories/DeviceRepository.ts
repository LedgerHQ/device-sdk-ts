import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type TestResult } from "@root/src/domain/types/TestStatus";

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
