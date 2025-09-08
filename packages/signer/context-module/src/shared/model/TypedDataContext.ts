import { type DeviceModelId } from "@ledgerhq/device-management-kit";

// The schema of a typed message
export type TypedDataSchema = Record<
  string,
  Array<{ name: string; type: string }>
>;

// The extracted message values, with their path
export type TypedDataFieldValues = Array<{ path: string; value: Uint8Array }>;

// Context needed to fetch the clear signing context of a typed message
export type TypedDataContext = {
  deviceModelId: DeviceModelId; // needed to fetch the correct certificate
  verifyingContract: string;
  chainId: number;
  version: "v1" | "v2";
  schema: TypedDataSchema;
  challenge?: string;
  fieldsValues: TypedDataFieldValues;
};
