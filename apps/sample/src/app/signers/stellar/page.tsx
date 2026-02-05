"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerStellarView } from "@/components/SignerStellarView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerStellarView} />;
};

export default Signer;
