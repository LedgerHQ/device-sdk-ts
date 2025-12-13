"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerCosmosView } from "@/components/SignerCosmosView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerCosmosView} />;
};

export default Signer;
