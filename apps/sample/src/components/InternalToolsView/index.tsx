import React from "react";
import { Grid, Icons } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";

import { ClickableListItem } from "@/components/ClickableListItem";
import { PageWithHeader } from "@/components/PageWithHeader";

const INTERNAL_TOOLS = [
  {
    title: "Sideload App",
    description: "Replay a .apdu install script onto the connected device.",
    route: "sideload-app",
    icon: <Icons.CloudUpload size="XL" />,
  },
  {
    title: "Onboard Device",
    description:
      "Provision a device with a PIN and a BIP39 seed phrase for testing.",
    route: "onboard-device",
    icon: <Icons.LedgerDevices size="XL" />,
  },
];

export const InternalToolsView: React.FC = () => {
  const router = useRouter();

  return (
    <PageWithHeader title="Ledger Internal Tools">
      <Grid
        columns={2}
        style={{ rowGap: 6, columnGap: 6, overflowY: "scroll" }}
      >
        {INTERNAL_TOOLS.map(({ title, description, route, icon }) => (
          <ClickableListItem
            key={`internal-tools-${route}`}
            title={title}
            description={description}
            onClick={() => router.push(`/internal-tools/${route}`)}
            icon={icon}
          />
        ))}
      </Grid>
    </PageWithHeader>
  );
};
