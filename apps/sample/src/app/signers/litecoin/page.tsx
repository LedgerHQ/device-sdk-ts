"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerLitecoinView } from "@/components/SignerLitecoinView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerLitecoinView} />;
};

export default Signer;
