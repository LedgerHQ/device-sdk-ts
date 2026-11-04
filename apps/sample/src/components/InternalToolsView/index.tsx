import React from "react";
import { CloudUpload, LedgerDevices } from "@ledgerhq/lumen-ui-react/symbols";
import { useRouter } from "next/navigation";

import { ClickableListItem } from "@/components/ClickableListItem";
import { PageWithHeader } from "@/components/PageWithHeader";

const INTERNAL_TOOLS = [
  {
    title: "Sideload App",
    description: "Replay a .apdu install script onto the connected device.",
    route: "sideload-app",
    icon: <CloudUpload size={32} />,
  },
  {
    title: "Onboard Device",
    description:
      "Provision a device with a PIN and a BIP39 seed phrase for testing.",
    route: "onboard-device",
    icon: <LedgerDevices size={32} />,
  },
];

export const InternalToolsView: React.FC = () => {
  const router = useRouter();

  return (
    <PageWithHeader title="Ledger Internal Tools">
      <div className="grid grid-cols-2 gap-[6px] overflow-y-scroll">
        {INTERNAL_TOOLS.map(({ title, description, route, icon }) => (
          <ClickableListItem
            key={`internal-tools-${route}`}
            title={title}
            description={description}
            onClick={() => router.push(`/internal-tools/${route}`)}
            icon={icon}
          />
        ))}
      </div>
    </PageWithHeader>
  );
};
