"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerCantonView } from "@/components/SignerCantonView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerCantonView} />;
};

export default Signer;
