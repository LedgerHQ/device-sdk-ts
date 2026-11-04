import React from "react";
import { type ApduResponse } from "@ledgerhq/device-management-kit";

import { Copyable } from "@/components/Copyable";

import { formatDisplayableHexString, toPlainHexString } from "./hexUtils";

export const CopyableApdu: React.FC<{
  rawApdu: Uint8Array;
}> = ({ rawApdu }) => {
  return (
    <Copyable copyValue={toPlainHexString(rawApdu)}>
      {formatDisplayableHexString(rawApdu)}
    </Copyable>
  );
};

export const CopyableApduResponse: React.FC<{
  response: ApduResponse;
}> = ({ response }) => {
  const copyValue =
    toPlainHexString(response.data) + toPlainHexString(response.statusCode);

  return (
    <Copyable copyValue={copyValue}>
      {formatDisplayableHexString(response.data)}{" "}
      <span className="body-2-semi-bold">
        {formatDisplayableHexString(response.statusCode)}
      </span>
    </Copyable>
  );
};
