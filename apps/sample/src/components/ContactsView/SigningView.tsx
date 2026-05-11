import React from "react";
import { Flex, Text } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { PageWithHeader } from "@/components/PageWithHeader";
import { SectionTitle } from "@/components/SettingsView/SectionTitle";

import { BackToContactsLink } from "./_shared";

export const SigningView: React.FC = () => {
  return (
    <PageWithHeader title="Signing transactions">
      <Flex flexDirection="column" flex={1} overflowY="auto" pb={8} rowGap={6}>
        <BackToContactsLink />
        <Block>
          <SectionTitle>Send to Contact</SectionTitle>
          <Text variant="paragraph" color="opacityDefault.c60">
            M7 not yet implemented — Send-to-Contact orchestration will appear
            here. Sequences Provide Ledger Account Contact (from) + Provide
            Contact (to) + Sign transaction, so the device sign review shows
            both friendly names.
          </Text>
        </Block>
      </Flex>
    </PageWithHeader>
  );
};
