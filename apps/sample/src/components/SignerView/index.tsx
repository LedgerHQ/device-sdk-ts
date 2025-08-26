import React from "react";
import { CryptoIcons, Grid } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";

import { PageWithHeader } from "@/components//PageWithHeader";
import { ClickableListItem } from "@/components/ClickableListItem";

const SUPPORTED_SIGNERS = [
  {
    title: "Ethereum",
    description: "Access EVM compatible signer functionality",
    icon: <CryptoIcons.ETH size={80} />,
  },
  {
    title: "Bitcoin",
    description: "Access Bitcoin signer functionality",
    icon: <CryptoIcons.BTC size={80} />,
  },
  {
    title: "Solana",
    description: "Access Solana signer functionality",
    icon: <CryptoIcons.SOL size={80} />,
  },
  {
    title: "Canton",
    description: "Access Canton signer functionality",
    icon: <CryptoIcons.CDT size={80} />, //todo change icon when available
  },
];

export const SignerView = () => {
  const router = useRouter();

  return (
    <PageWithHeader title="Signers">
      <Grid
        columns={2}
        style={{ rowGap: 6, columnGap: 6, overflowY: "scroll" }}
      >
        {SUPPORTED_SIGNERS.map(({ title, description, icon }) => (
          <ClickableListItem
            key={`signers-${title}`}
            title={title}
            description={description}
            onClick={() => {
              router.push(`/signers/${title.toLowerCase()}`);
            }}
            icon={icon}
          />
        ))}
      </Grid>
    </PageWithHeader>
  );
};
