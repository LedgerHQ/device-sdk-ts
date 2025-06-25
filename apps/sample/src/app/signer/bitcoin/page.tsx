"use client";
import React from "react";
import dynamic from "next/dynamic";

import { SessionIdWrapper } from "@/components/SessionIdWrapper";

const NoSSRSignerBtcView = dynamic(
  () => import("@/components/SignerBtcView").then((mod) => mod.SignerBtcView),
  {
    ssr: false,
  },
);
const Signer: React.FC = () => {
  return (
    <SessionIdWrapper
      ChildComponent={(props) => <NoSSRSignerBtcView {...props} />}
    />
  );
};

export default Signer;
