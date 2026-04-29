"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerAleoView } from "@/components/SignerAleoView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerAleoView} />;
};

export default Signer;
