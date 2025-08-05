"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerSolanaView } from "@/components/SignerSolanaView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerSolanaView} />;
};

export default Signer;
