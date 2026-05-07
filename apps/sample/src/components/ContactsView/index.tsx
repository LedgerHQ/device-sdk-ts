import React, { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Flex, SelectInput, Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

import { Block } from "@/components/Block";
import { PageWithHeader } from "@/components/PageWithHeader";
import { SectionTitle } from "@/components/SettingsView/SectionTitle";
import { FIXTURES } from "@/state/contacts/fixtures";
import {
  selectAccountsCount,
  selectContactsCount,
  selectWallet,
} from "@/state/contacts/selectors";
import { resetWallet, setWallet } from "@/state/contacts/slice";

type FixtureOption = { label: string; value: string };

const fixtureOptions: FixtureOption[] = FIXTURES.map((f) => ({
  label: f.label,
  value: f.id,
}));

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
  const [pendingFixture, setPendingFixture] = useState<FixtureOption | null>(
    null,
  );

  const onLoadFixture = useCallback(() => {
    if (!pendingFixture) return;
    const fixture = FIXTURES.find((f) => f.id === pendingFixture.value);
    if (!fixture) return;
    dispatch(setWallet(fixture.wallet));
  }, [dispatch, pendingFixture]);

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
        "Reset will clear all client-side Contacts state. Device-side records (HMACs) are unaffected. Continue?",
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
            M1 — foundation only. Device-driven CRUD lands in M2+ (Register,
            Rename, Edit, Provide). See plan in <code>~/.claude/plans/</code>.
          </Text>
        </Block>

        <Block>
          <SectionTitle>Storage viewer</SectionTitle>
          <StoragePre>{JSON.stringify(wallet, null, 2)}</StoragePre>
        </Block>

        <Block>
          <SectionTitle>Load fixture</SectionTitle>
          <Text variant="paragraph" color="opacityDefault.c60">
            Hand-picked client-side wallets to scaffold UI development. Hex
            values are illustrative — they do not pass device-side HMAC
            verification.
          </Text>
          <Flex columnGap={4} alignItems="center">
            <Flex flex={1}>
              <SelectInput
                options={fixtureOptions}
                value={pendingFixture}
                onChange={(opt) =>
                  setPendingFixture(opt as FixtureOption | null)
                }
                isMulti={false}
                isSearchable={false}
                placeholder="Pick a fixture"
              />
            </Flex>
            <Button
              variant="main"
              onClick={onLoadFixture}
              disabled={!pendingFixture}
            >
              Load
            </Button>
          </Flex>
        </Block>

        <Block>
          <SectionTitle>Reset</SectionTitle>
          <Text variant="paragraph" color="opacityDefault.c60">
            Wipes the client-side wallet and removes the localStorage key.
            Device-side records (HMACs, group handles) are not touched.
          </Text>
          <Flex>
            <Button variant="error" onClick={onReset}>
              Reset wallet
            </Button>
          </Flex>
        </Block>
      </Flex>
    </PageWithHeader>
  );
};
