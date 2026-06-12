import React from "react";
import { Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { PageWithHeader } from "@/components/PageWithHeader";
import { SectionTitle } from "@/components/SettingsView/SectionTitle";

import { BackToContactsLink } from "./_shared";
import { SendToContactForm } from "./SendToContactForm";

export const SigningView: React.FC = () => {
  return (
    <PageWithHeader title="Signing transactions">
      <Flex flexDirection="column" flex={1} overflowY="auto" pb={8} rowGap={6}>
        <BackToContactsLink />
        <Block>
          <SectionTitle>Send to Contact</SectionTitle>
          <SendToContactForm />
        </Block>
      </Flex>
    </PageWithHeader>
  );
};
