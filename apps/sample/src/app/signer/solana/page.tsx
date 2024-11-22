"use client";
import React from "react";
import dynamic from "next/dynamic";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";
const SignerSolanaView = dynamic(
  () =>
    import("@/components/SignerSolanaView").then((mod) => mod.SignerSolanaView),
  { ssr: false },
);
const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerSolanaView} />;
};

export default Signer;
