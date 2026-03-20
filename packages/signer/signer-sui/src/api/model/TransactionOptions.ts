import { type DescriptorInput } from "@internal/app-binder/task/ProvideTrustedDynamicDescriptorTask";

export type TransactionOptions = {
  objectData?: Uint8Array[];
  descriptor?: DescriptorInput;
  skipOpenApp?: boolean;
};
