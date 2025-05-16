"use client";
import React from "react";

import { LedgerSyncView } from "@/components/LedgerSyncView";
import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const LedgerSync: React.FC = () => {
  return <SessionIdWrapper ChildComponent={LedgerSyncView} />;
};

export default LedgerSync;
