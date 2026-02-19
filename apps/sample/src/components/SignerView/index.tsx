import React from "react";
import { CryptoIcon } from "@ledgerhq/crypto-icons";
import { Grid } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";

import { PageWithHeader } from "@/components//PageWithHeader";
import { ClickableListItem } from "@/components/ClickableListItem";

const size = "48px";

const SUPPORTED_SIGNERS = [
  {
    title: "Ethereum",
    description: "Access EVM compatible signer functionality",
    icon: <CryptoIcon ledgerId="ethereum" ticker="ETH" size={size} />,
  },
  {
    title: "Bitcoin",
    description: "Access Bitcoin signer functionality",
    icon: <CryptoIcon ledgerId="bitcoin" ticker="BTC" size={size} />,
  },
  {
    title: "Solana",
    description: "Access Solana signer functionality",
    icon: <CryptoIcon ledgerId="solana" ticker="SOL" size={size} />,
  },
  {
    title: "Hyperliquid",
    description: "Access Hyperliquid signer functionality",
    icon: (
      <CryptoIcon ledgerId="hyperliquid" ticker="HYPERLIQUID" size="56px" />
    ),
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
