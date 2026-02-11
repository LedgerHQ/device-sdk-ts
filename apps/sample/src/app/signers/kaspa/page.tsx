"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerKaspaView } from "@/components/SignerKaspaView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerKaspaView} />;
};

export default Signer;
