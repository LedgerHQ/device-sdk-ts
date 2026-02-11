"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerMultiversxView } from "@/components/SignerMultiversxView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerMultiversxView} />;
};

export default Signer;
