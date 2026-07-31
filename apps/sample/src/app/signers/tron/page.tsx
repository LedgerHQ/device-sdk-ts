"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerTrxView } from "@/components/SignerTrxView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerTrxView} />;
};

export default Signer;
