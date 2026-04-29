"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerHyperliquidView } from "@/components/SignerHyperliquidView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerHyperliquidView} />;
};

export default Signer;
