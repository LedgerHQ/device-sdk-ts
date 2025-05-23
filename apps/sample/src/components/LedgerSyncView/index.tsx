import React from "react";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useLedgerSync } from "@/providers/LedgerSync";

export const LedgerSyncView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const app = useLedgerSync();

  console.log(dmk, app, sessionId);

  return <div>Ledger Sync</div>;
};
