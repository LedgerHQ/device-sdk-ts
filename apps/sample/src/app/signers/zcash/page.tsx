"use client";

import React from "react";
import dynamic from "next/dynamic";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const SignerZcashView = dynamic(
  () =>
    import("@/components/SignerZcashView").then((mod) => ({
      default: mod.SignerZcashView,
    })),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
        Loading Zcash signer…
      </div>
    ),
  },
);

const Signer: React.FC = () => {
  return <SessionIdWrapper ChildComponent={SignerZcashView} />;
};

export default Signer;
