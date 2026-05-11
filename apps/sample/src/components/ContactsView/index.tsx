import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Flex, Grid, Icons, Text } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";
import styled, { type DefaultTheme } from "styled-components";

import { Block } from "@/components/Block";
import { ClickableListItem } from "@/components/ClickableListItem";
import { PageWithHeader } from "@/components/PageWithHeader";
import { SectionTitle } from "@/components/SettingsView/SectionTitle";
import {
  selectAccountsCount,
  selectContactsCount,
  selectWallet,
} from "@/state/contacts/selectors";
import { resetWallet } from "@/state/contacts/slice";

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

const SUBSECTIONS = [
  {
    title: "Contacts",
    description:
      "Register, rename, edit labels, and edit addresses for cross-chain contacts.",
    href: "/services/contacts/external-addresses",
    icon: (
      <Flex p={3} backgroundColor="background.card" borderRadius="50%">
        <Icons.User size="L" />
      </Flex>
    ),
  },
  {
    title: "Ledger accounts",
    description:
      "Register signer-controlled Ledger accounts used as the From side of a Send.",
    href: "/services/contacts/ledger-accounts",
    icon: (
      <Flex p={3} backgroundColor="background.card" borderRadius="50%">
        <Icons.LedgerDevices size="L" />
      </Flex>
    ),
  },
  {
    title: "Signing transactions",
    description:
      "Send to Contact: Provide From + Provide To + Sign, with both friendly names on device.",
    href: "/services/contacts/signing",
    icon: (
      <Flex p={3} backgroundColor="background.card" borderRadius="50%">
        <Icons.Signature size="L" />
      </Flex>
    ),
  },
];

export const ContactsView: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const wallet = useSelector(selectWallet);
  const contactsCount = useSelector(selectContactsCount);
  const accountsCount = useSelector(selectAccountsCount);

  const isEmpty = contactsCount === 0 && accountsCount === 0;

  const onReset = useCallback(() => {
    if (
      typeof window === "undefined" ||
      window.confirm(
        "Reset will clear the client-side contact book. Device-side records (HMACs) are unaffected. Continue?",
      )
    ) {
      dispatch(resetWallet());
    }
  }, [dispatch]);

  return (
    <PageWithHeader title="Contacts">
      <Flex flexDirection="column" flex={1} overflowY="auto" pb={8} rowGap={6}>
        <Block>
          <SectionTitle>Overview</SectionTitle>
          <Text variant="body" color="opacityDefault.c70">
            {contactsCount} contact{contactsCount === 1 ? "" : "s"} ·{" "}
            {accountsCount} signer-controlled account
            {accountsCount === 1 ? "" : "s"}.
          </Text>
          <Text variant="body" color="opacityDefault.c70">
            Schema version {wallet.schemaVersion}.
          </Text>
          <Text variant="body" color="opacityDefault.c70">
            Persisted under <code>dmk-sample-contacts-state</code> in
            localStorage.
          </Text>
        </Block>

        <Block>
          <SectionTitle>Sections</SectionTitle>
          <Grid columns={2} style={{ rowGap: 16, columnGap: 16 }}>
            {SUBSECTIONS.map(({ title, description, icon, href }) => (
              <ClickableListItem
                key={`contacts-section-${title}`}
                title={title}
                description={description}
                onClick={() => router.push(href)}
                icon={icon}
              />
            ))}
          </Grid>
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
            <Button variant="error" disabled={isEmpty} onClick={onReset}>
              Reset contacts
            </Button>
          </Flex>
        </Block>
      </Flex>
    </PageWithHeader>
  );
};
