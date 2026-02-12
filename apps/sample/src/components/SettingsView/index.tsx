import React from "react";
import { Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { PageWithHeader } from "@/components/PageWithHeader";

import { AppProviderSetting } from "./AppProviderSetting";
import { BypassIntentQueueSetting } from "./BypassIntentQueueSetting";
import { CalBranchSetting } from "./CalBranchSetting";
import { CalModeSetting } from "./CalModeSetting";
import { CalUrlSetting } from "./CalUrlSetting";
import { DatasourceProxySetting } from "./DatasourceProxySetting";
import { MetadataServiceUrlSetting } from "./MetadataServiceUrlSetting";
import { MockServerToggleSetting } from "./MockServerToggleSetting";
import { MockServerUrlSetting } from "./MockServerUrlSetting";
import { OriginTokenSetting } from "./OriginTokenSetting";
import { PollingIntervalSetting } from "./PollingIntervalSetting";
import { SectionTitle } from "./SectionTitle";
import { SpeculosToggleSetting } from "./SpeculosToggleSetting";
import { SpeculosUrlSetting } from "./SpeculosUrlSetting";
import { SpeculosVncUrlSetting } from "./SpeculosVncUrlSetting";
import { Web3ChecksUrlSetting } from "./Web3ChecksUrlSetting";

const SectionContainer = Block;

export const SettingsView: React.FC = () => {
  return (
    <PageWithHeader title="Settings">
      <Flex flexDirection="column" flex={1} overflowY="auto" pb={8} rowGap={6}>
        <SectionContainer>
          <SectionTitle>Device Management Kit</SectionTitle>
          <AppProviderSetting />
          <PollingIntervalSetting />
          <BypassIntentQueueSetting />
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Speculos</SectionTitle>
          <SpeculosToggleSetting />
          <SpeculosUrlSetting />
          <SpeculosVncUrlSetting />
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Mock server</SectionTitle>
          <MockServerToggleSetting />
          <MockServerUrlSetting />
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Crypto Assets Service</SectionTitle>
          <CalUrlSetting />
          <CalModeSetting />
          <CalBranchSetting />
          <OriginTokenSetting />
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Metadata Service</SectionTitle>
          <MetadataServiceUrlSetting />
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Web3Checks</SectionTitle>
          <Web3ChecksUrlSetting />
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Ethereum Signer</SectionTitle>
          <DatasourceProxySetting />
        </SectionContainer>
      </Flex>
    </PageWithHeader>
  );
};
