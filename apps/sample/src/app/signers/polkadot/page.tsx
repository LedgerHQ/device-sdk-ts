"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerPolkadotView } from "@/components/SignerPolkadotView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerPolkadotView} />;
};

export default Signer;
