import React from "react";
import { Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { PageWithHeader } from "@/components/PageWithHeader";
import { SectionTitle } from "@/components/SettingsView/SectionTitle";

import { BackToContactsLink } from "./_shared";
import { EditExternalAddressForm } from "./EditExternalAddressForm";
import { EditExternalAddressLabelForm } from "./EditExternalAddressLabelForm";
import { RegisterExternalAddressForm } from "./RegisterExternalAddressForm";
import { RenameContactForm } from "./RenameContactForm";

export const ExternalAddressesView: React.FC = () => {
  return (
    <PageWithHeader title="External addresses">
      <Flex flexDirection="column" flex={1} overflowY="auto" pb={8} rowGap={6}>
        <BackToContactsLink />
        <Block>
          <SectionTitle>Register external address</SectionTitle>
          <RegisterExternalAddressForm />
        </Block>

        <Block>
          <SectionTitle>Rename contact</SectionTitle>
          <RenameContactForm />
        </Block>

        <Block>
          <SectionTitle>Edit address label</SectionTitle>
          <EditExternalAddressLabelForm />
        </Block>

        <Block>
          <SectionTitle>Edit address</SectionTitle>
          <EditExternalAddressForm />
        </Block>
      </Flex>
    </PageWithHeader>
  );
};
