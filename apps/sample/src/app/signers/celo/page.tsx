"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerCeloView } from "@/components/SignerCeloView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerCeloView} />;
};

export default Signer;
