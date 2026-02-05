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
    title: "Algorand",
    description: "Access Algorand signer functionality",
    icon: <CryptoIcons.ALGO size={80} />,
  },
  {
    title: "Aptos",
    description: "Access Aptos signer functionality",
    icon: <CryptoIcons.APT size={80} />,
  },
  {
    title: "Canton",
    description: "Access Canton signer functionality",
    icon: <CryptoIcons.ADA size={80} />, // Canton is based on Cardano
  },
  {
    title: "Celo",
    description: "Access Celo signer functionality",
    icon: <CryptoIcons.CELO size={80} />,
  },
  {
    title: "Concordium",
    description: "Access Concordium signer functionality",
    icon: <CryptoIcons.GENERIC size={80} />,
  },
  {
    title: "Hedera",
    description: "Access Hedera signer functionality",
    icon: <CryptoIcons.HBAR size={80} />,
  },
  {
    title: "Helium",
    description: "Access Helium signer functionality",
    icon: <CryptoIcons.GENERIC size={80} />,
  },
  {
    title: "Icon",
    description: "Access Icon signer functionality",
    icon: <CryptoIcons.ICX size={80} />,
  },
  {
    title: "Kaspa",
    description: "Access Kaspa signer functionality",
    icon: <CryptoIcons.GENERIC size={80} />,
  },
  {
    title: "Multiversx",
    description: "Access Multiversx signer functionality",
    icon: <CryptoIcons.EGLD size={80} />,
  },
  {
    title: "Near",
    description: "Access Near signer functionality",
    icon: <CryptoIcons.NEAR size={80} />,
  },
  {
    title: "Polkadot",
    description: "Access Polkadot signer functionality",
    icon: <CryptoIcons.DOT size={80} />,
  },
  {
    title: "Stellar",
    description: "Access Stellar signer functionality",
    icon: <CryptoIcons.XLM size={80} />,
  },
  {
    title: "Sui",
    description: "Access Sui signer functionality",
    icon: <CryptoIcons.GENERIC size={80} />,
  },
  {
    title: "Tezos",
    description: "Access Tezos signer functionality",
    icon: <CryptoIcons.XTZ size={80} />,
  },
  {
    title: "Tron",
    description: "Access Tron signer functionality",
    icon: <CryptoIcons.TRX size={80} />,
  },
  {
    title: "Vechain",
    description: "Access Vechain signer functionality",
    icon: <CryptoIcons.VET size={80} />,
  },
  {
    title: "Xrp",
    description: "Access Xrp signer functionality",
    icon: <CryptoIcons.XRP size={80} />,
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
