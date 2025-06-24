import React from "react";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useLedgerKeyringProtocol } from "@/providers/LedgerKeyringProvider";

export const LedgerKeyringProtocolView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const app = useLedgerKeyringProtocol();

  console.log(dmk, app, sessionId);

  return <div>Ledger Keyring Protocol</div>;
};
