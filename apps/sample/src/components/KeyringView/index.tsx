import React from "react";
import { CryptoIcons, Grid } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";

import { PageWithHeader } from "@/components//PageWithHeader";
import { ClickableListItem } from "@/components/ClickableListItem";

const SUPPORTED_KEYRINGS = [
  {
    title: "Ethereum",
    description: "Access EVM compatible keyring functionality",
    icon: <CryptoIcons.ETH size={80} />,
  },
  {
    title: "Bitcoin",
    description: "Access Bitcoin keyring functionality",
    icon: <CryptoIcons.BTC size={80} />,
  },
];

export const KeyringView = () => {
  const router = useRouter();

  return (
    <PageWithHeader title="Keyrings">
      <Grid
        columns={2}
        style={{ rowGap: 6, columnGap: 6, overflowY: "scroll" }}
      >
        {SUPPORTED_KEYRINGS.map(({ title, description, icon }) => (
          <ClickableListItem
            key={`keyring-${title}`}
            title={title}
            description={description}
            onClick={() => {
              router.push(`/keyring/${title.toLowerCase()}`);
            }}
            icon={icon}
          />
        ))}
      </Grid>
    </PageWithHeader>
  );
};
