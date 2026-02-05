"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerTezosView } from "@/components/SignerTezosView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerTezosView} />;
};

export default Signer;
