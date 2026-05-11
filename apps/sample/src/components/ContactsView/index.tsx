import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Flex, Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

import { Block } from "@/components/Block";
import { PageWithHeader } from "@/components/PageWithHeader";
import { SectionTitle } from "@/components/SettingsView/SectionTitle";
import {
  selectAccountsCount,
  selectContactsCount,
  selectWallet,
} from "@/state/contacts/selectors";
import { resetWallet } from "@/state/contacts/slice";

import { EditExternalAddressForm } from "./EditExternalAddressForm";
import { EditExternalAddressLabelForm } from "./EditExternalAddressLabelForm";
import { RegisterExternalAddressForm } from "./RegisterExternalAddressForm";
import { RenameContactForm } from "./RenameContactForm";

const StoragePre = styled.pre`
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c20};
  border-radius: ${({ theme }: { theme: DefaultTheme }) =>
    `${theme.space[2]}px`};
  padding: ${({ theme }: { theme: DefaultTheme }) => `${theme.space[4]}px`};
  margin: 0;
  max-height: 480px;
  overflow: auto;
  font-family: monospace;
  font-size: 12px;
  white-space: pre;
  /* keep width inside the parent flex column even with long lines */
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
`;

export const ContactsView: React.FC = () => {
  const dispatch = useDispatch();
  const wallet = useSelector(selectWallet);
  const contactsCount = useSelector(selectContactsCount);
  const accountsCount = useSelector(selectAccountsCount);

  const onReset = useCallback(() => {
    if (
      contactsCount === 0 &&
      accountsCount === 0 &&
      typeof window !== "undefined"
    ) {
      dispatch(resetWallet());
      return;
    }
    if (
      typeof window === "undefined" ||
      window.confirm(
        "Reset will clear the client-side contact book. Device-side records (HMACs) are unaffected. Continue?",
      )
    ) {
      dispatch(resetWallet());
    }
  }, [accountsCount, contactsCount, dispatch]);

  return (
    <PageWithHeader title="Contacts">
      <Flex flexDirection="column" flex={1} overflowY="auto" pb={8} rowGap={6}>
        <Block>
          <SectionTitle>Overview</SectionTitle>
          <Text variant="body" color="opacityDefault.c70">
            {contactsCount} contact{contactsCount === 1 ? "" : "s"} ·{" "}
            {accountsCount} signer-controlled account
            {accountsCount === 1 ? "" : "s"}. Schema version{" "}
            {wallet.schemaVersion}. Persisted under{" "}
            <code>dmk-sample-contacts-state</code> in localStorage.
          </Text>
          <Text variant="paragraph" color="opacityDefault.c50">
            M5 — Edit external address label (DMK-core, op 2) + Edit external
            address (signer-eth, op 3) landed. Register Ledger account (M6),
            Provide ops + Send-to-Contact (M7) pending.
          </Text>
        </Block>

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

        <Block>
          <SectionTitle>Storage viewer</SectionTitle>
          <StoragePre>{JSON.stringify(wallet, null, 2)}</StoragePre>
        </Block>

        <Block>
          <SectionTitle>Reset</SectionTitle>
          <Text variant="paragraph" color="opacityDefault.c60">
            Wipes the client-side contact book and removes the localStorage key.
            Device-side records (HMACs, group handles) are not touched.
          </Text>
          <Flex>
            <Button variant="error" onClick={onReset}>
              Reset contact book
            </Button>
          </Flex>
        </Block>
      </Flex>
    </PageWithHeader>
  );
};
