"use client";
import React from "react";

import { LedgerKeyringProtocolView } from "@/components/LedgerProtocolKeyringView";
import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const LedgerKeyringProtocol: React.FC = () => {
  return <SessionIdWrapper ChildComponent={LedgerKeyringProtocolView} />;
};

export default LedgerKeyringProtocol;
