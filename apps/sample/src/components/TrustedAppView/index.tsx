import React from "react";
import { Grid, Icons } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";

import { PageWithHeader } from "@/components//PageWithHeader";
import { ClickableListItem } from "@/components/ClickableListItem";
import { useLedgerKeyRingProtocol } from "@/providers/LedgerKeyringProvider";

const SUPPORTED_TRUSTED_APPS = [
  {
    title: "Ledger Sync",
    key: "ledger-sync",
    description: "Access Ledger Sync functionality",
    icon: <Icons.LedgerDevices size="L" />,
  },
];

export const TrustedAppView = () => {
  const router = useRouter();
  const app = useLedgerKeyRingProtocol();

  console.log(app);

  return (
    <PageWithHeader title="TrustedApps">
      <Grid
        columns={2}
        style={{ rowGap: 6, columnGap: 6, overflowY: "scroll" }}
      >
        {SUPPORTED_TRUSTED_APPS.map(({ title, description, icon, key }) => (
          <ClickableListItem
            key={`trusted-apps-${key}`}
            title={title}
            description={description}
            onClick={() => {
              router.push(`/trusted-apps/${key}`);
            }}
            icon={icon}
          />
        ))}
      </Grid>
    </PageWithHeader>
  );
};
