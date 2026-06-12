import React from "react";
import { Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { PageWithHeader } from "@/components/PageWithHeader";
import { SectionTitle } from "@/components/SettingsView/SectionTitle";

import { BackToContactsLink } from "./_shared";
import { RegisterLedgerAccountForm } from "./RegisterLedgerAccountForm";

export const LedgerAccountsView: React.FC = () => {
  return (
    <PageWithHeader title="Ledger accounts">
      <Flex flexDirection="column" flex={1} overflowY="auto" pb={8} rowGap={6}>
        <BackToContactsLink />
        <Block>
          <SectionTitle>Register Ledger account</SectionTitle>
          <RegisterLedgerAccountForm />
        </Block>
      </Flex>
    </PageWithHeader>
  );
};
