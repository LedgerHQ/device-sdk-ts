import React from "react";
import Image from "next/image";

import { ConnectDeviceButtons } from "@/components/ConnectDevice/ConnectDeviceButtons";

export const MainView: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-24">
      <Image
        src={"/devices_crop.png"}
        alt={"ledger-devices-image"}
        width={400}
        height={330}
      />
      <h2 className="heading-1-semi-bold text-base">
        Ledger Device Management Kit
      </h2>
      <p className="body-2 text-muted">
        Use this application to test Ledger hardware device features.
      </p>
      <ConnectDeviceButtons />
    </div>
  );
};
