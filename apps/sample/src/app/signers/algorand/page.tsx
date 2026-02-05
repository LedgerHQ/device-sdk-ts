"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerAlgorandView } from "@/components/SignerAlgorandView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerAlgorandView} />;
};

export default Signer;
