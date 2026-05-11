import React from "react";
import { Flex, Text } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { PageWithHeader } from "@/components/PageWithHeader";
import { SectionTitle } from "@/components/SettingsView/SectionTitle";

import { BackToContactsLink } from "./_shared";

export const LedgerAccountsView: React.FC = () => {
  return (
    <PageWithHeader title="Ledger accounts">
      <Flex flexDirection="column" flex={1} overflowY="auto" pb={8} rowGap={6}>
        <BackToContactsLink />
        <Block>
          <SectionTitle>Register Ledger account</SectionTitle>
          <Text variant="paragraph" color="opacityDefault.c60">
            M6 not yet implemented — Register Ledger account (signer-eth, op 5)
            will appear here. Two-APDU flow: Register, then GetAddress to cache
            the derived ETH address.
          </Text>
        </Block>
      </Flex>
    </PageWithHeader>
  );
};
