"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerConcordiumView } from "@/components/SignerConcordiumView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerConcordiumView} />;
};

export default Signer;
