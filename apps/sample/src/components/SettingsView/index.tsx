import React from "react";

import { Block } from "@/components/Block";
import { PageWithHeader } from "@/components/PageWithHeader";

import { AppProviderSetting } from "./AppProviderSetting";
import { BypassIntentQueueSetting } from "./BypassIntentQueueSetting";
import { CalBranchSetting } from "./CalBranchSetting";
import { CalModeSetting } from "./CalModeSetting";
import { CalUrlSetting } from "./CalUrlSetting";
import { DatasourceProxySetting } from "./DatasourceProxySetting";
import { FirmwareDistributionSaltSetting } from "./FirmwareDistributionSaltSetting";
import { MetadataServiceUrlSetting } from "./MetadataServiceUrlSetting";
import { MockServerSessionTokenSetting } from "./MockServerSessionTokenSetting";
import { MockServerToggleSetting } from "./MockServerToggleSetting";
import { MockServerUrlSetting } from "./MockServerUrlSetting";
import { OriginTokenSetting } from "./OriginTokenSetting";
import { PollingIntervalSetting } from "./PollingIntervalSetting";
import { ReporterUrlSetting } from "./ReporterUrlSetting";
import { SectionTitle } from "./SectionTitle";
import { SolanaDisabledFeaturesSetting } from "./SolanaDisabledFeaturesSetting";
import { SpeculosDeviceModelSetting } from "./SpeculosDeviceModelSetting";
import { SpeculosToggleSetting } from "./SpeculosToggleSetting";
import { SpeculosUrlSetting } from "./SpeculosUrlSetting";
import { Web3ChecksUrlSetting } from "./Web3ChecksUrlSetting";
import { WebSocketUrlSetting } from "./WebSocketUrlSetting";

const SectionContainer = Block;

export const SettingsView: React.FC = () => {
  return (
    <PageWithHeader title="Settings">
      <div className="flex flex-col flex-1 overflow-y-auto pb-24 gap-y-16">
        <SectionContainer>
          <SectionTitle>Device Management Kit</SectionTitle>
          <AppProviderSetting />
          <FirmwareDistributionSaltSetting />
          <WebSocketUrlSetting />
          <PollingIntervalSetting />
          <BypassIntentQueueSetting />
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Speculos</SectionTitle>
          <SpeculosToggleSetting />
          <SpeculosUrlSetting />
          <SpeculosDeviceModelSetting />
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Mock server</SectionTitle>
          <MockServerToggleSetting />
          <MockServerUrlSetting />
          <MockServerSessionTokenSetting />
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
          <SectionTitle>Blind Signing Reporter</SectionTitle>
          <ReporterUrlSetting />
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Ethereum Signer</SectionTitle>
          <DatasourceProxySetting />
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Solana Signer</SectionTitle>
          <SolanaDisabledFeaturesSetting />
        </SectionContainer>
      </div>
    </PageWithHeader>
  );
};
