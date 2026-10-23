"use client";
import React from "react";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
import { SignerDogecoinView } from "@/components/SignerDogecoinView";

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerDogecoinView} />;
};

export default Signer;
