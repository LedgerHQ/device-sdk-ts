import React from "react";
import {
  type DeviceActionIntermediateValue,
  DeviceActionStatus,
  DeviceModelId,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Flex, InfiniteLoader, Link, Tag, Text } from "@ledgerhq/react-ui";
import dynamic from "next/dynamic";
import styled from "styled-components";

import PinFlexDark from "./lotties/flex/01_EUROPA_DARK_PIN.json";
import PairingFlexDark from "./lotties/flex/02_EUROPA_DARK_PAIRING.json";
import PairedSuccessFlexDark from "./lotties/flex/03_EUROPA_DARK_PAIRED_SUCCESS.json";
import ContinueOnLedgerFlexDark from "./lotties/flex/04_EUROPA_DARK_CONTINUE_ON_LEDGER.json";
import SignTransactionFlexDark from "./lotties/flex/05_EUROPA_DARK_SIGN_TRANSACTION.json";
import FrontViewFlexDark from "./lotties/flex/06_STAX_DARK_FRONT_VIEW.json";
import PinNanoSDark from "./lotties/nanosp/01_NANO_S_DARK_PIN.json";
import ContinueOnLedgerNanoSDark from "./lotties/nanosp/02_NANO_S_DARK_CONTINUE_ON_YOUR_LEDGER.json";
import PinNanoXDark from "./lotties/nanox/01_NANO_X_DARK_PIN.json";
import PairingNanoXDark from "./lotties/nanox/02_NANO_X_DARK_PAIRING.json";
import ContinueOnLedgerNanoXDark from "./lotties/nanox/03_NANO_X_DARK_CONTINUE_ON_YOUR_LEDGER.json";
import PinStaxDark from "./lotties/stax/01_STAX_DARK_PIN.json";
import PairingStaxDark from "./lotties/stax/02_STAX_DARK_PAIRING.json";
import PairedSuccessStaxDark from "./lotties/stax/03_STAX_DARK_PAIRED_SUCCESS.json";
import ContinueOnLedgerStaxDark from "./lotties/stax/04_STAX_DARK_CONTINUE_ON_LEDGER.json";
import SignTransactionStaxDark from "./lotties/stax/05_STAX_DARK_SIGN_TRANSACTION.json";
import FrontViewStaxDark from "./lotties/stax/06_STAX_DARK_FRONT_VIEW.json";
import {
  type DeviceActionResponseProps,
  deviceActionStatusToColor,
} from "./DeviceActionResponse";

// Dynamic import to avoid SSR issues (react-lottie accesses `document` at load time)
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

type DeviceAnimationProps = {
  userInteractionRequired: UserInteractionRequired | string;
  deviceModelId: DeviceModelId;
};

type AnimationKey =
  | "pin"
  | "pairing"
  | "pairingSuccess"
  | "frontView"
  | "continueOnLedger"
  | "signTransaction";

const animationDataMap: Record<DeviceModelId, Record<AnimationKey, unknown>> = {
  [DeviceModelId.STAX]: {
    pin: PinStaxDark,
    pairing: PairingStaxDark,
    pairingSuccess: PairedSuccessStaxDark,
    frontView: FrontViewStaxDark,
    continueOnLedger: ContinueOnLedgerStaxDark,
    signTransaction: SignTransactionStaxDark,
  },
  [DeviceModelId.FLEX]: {
    pin: PinFlexDark,
    pairing: PairingFlexDark,
    pairingSuccess: PairedSuccessFlexDark,
    frontView: FrontViewFlexDark,
    continueOnLedger: ContinueOnLedgerFlexDark,
    signTransaction: SignTransactionFlexDark,
  },
  [DeviceModelId.APEX]: {
    // TODO: add animations for APEX
    pin: null,
    pairing: null,
    pairingSuccess: null,
    frontView: null,
    continueOnLedger: null,
    signTransaction: null,
  },
  [DeviceModelId.NANO_X]: {
    pin: PinNanoXDark,
    pairing: PairingNanoXDark,
    pairingSuccess: null,
    frontView: null,
    continueOnLedger: ContinueOnLedgerNanoXDark,
    signTransaction: ContinueOnLedgerNanoXDark,
  },
  [DeviceModelId.NANO_S]: {
    pin: PinNanoSDark,
    pairing: null,
    pairingSuccess: null,
    frontView: null,
    continueOnLedger: ContinueOnLedgerNanoSDark,
    signTransaction: ContinueOnLedgerNanoSDark,
  },
  [DeviceModelId.NANO_SP]: {
    pin: PinNanoSDark,
    pairing: null,
    pairingSuccess: null,
    frontView: null,
    continueOnLedger: ContinueOnLedgerNanoSDark,
    signTransaction: ContinueOnLedgerNanoSDark,
  },
};

const UserInteractionToAnimationKeyMap: Record<
  UserInteractionRequired | string,
  AnimationKey | null
> = {
  [UserInteractionRequired.None]: null,
  [UserInteractionRequired.UnlockDevice]: "pin",
  [UserInteractionRequired.AllowSecureConnection]: "continueOnLedger",
  [UserInteractionRequired.ConfirmOpenApp]: "continueOnLedger",
  [UserInteractionRequired.AllowListApps]: "continueOnLedger",
  [UserInteractionRequired.VerifyAddress]: "continueOnLedger",
  [UserInteractionRequired.SignTransaction]: "signTransaction",
  [UserInteractionRequired.SignTypedData]: "signTransaction",
  [UserInteractionRequired.SignPersonalMessage]: "signTransaction",
};

const WarningText = styled(Text).attrs({ mb: 4 })``;

const DeviceAnimation: React.FC<DeviceAnimationProps> = ({
  userInteractionRequired,
  deviceModelId,
}) => {
  const animationKey =
    UserInteractionToAnimationKeyMap[userInteractionRequired];
  const animationData = animationKey
    ? animationDataMap[deviceModelId][animationKey]
    : null;
  return (
    <>
      {animationData ? (
        <Lottie
          animationData={animationData}
          loop
          autoplay
          style={{ height: 200, width: 200 }}
        />
      ) : (
        <InfiniteLoader size={20} />
      )}
      {userInteractionRequired !== UserInteractionRequired.None ? (
        <>
          <WarningText>User action required: </WarningText>
          <Tag active type="opacity">
            {userInteractionRequired}
          </Tag>
        </>
      ) : null}
    </>
  );
};

type DeviceActionUIProps<Output, Error, IntermediateValue> = {
  lastResponse: DeviceActionResponseProps<
    Output,
    Error,
    IntermediateValue
  > | null;
  deviceModelId: DeviceModelId;
};

const PopoverWrapper = styled.div`
  position: relative;
  display: inline-flex;
`;

const PopoverContent = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 12px;
  border-radius: 4px;
  background: ${(p) => p.theme.colors.neutral.c100};
  max-width: 100%;
  z-index: 10;
`;

const JSONTextPopin: React.FC<{
  label: string;
  obj: unknown;
  color: string;
}> = ({ label, obj, color }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <Flex flexDirection="column" alignItems="center" rowGap={5}>
      <Text color={color} textAlign="center">
        {label}
      </Text>
      <PopoverWrapper>
        <Link type="shade" onClick={() => setOpen((prev) => !prev)}>
          {open ? "\nClick to hide value" : "\nClick to reveal value"}
        </Link>
        {open && (
          <PopoverContent>
            <Flex overflow="scroll" maxHeight="400px">
              <Text color="neutral.c00" whiteSpace="pre-wrap">
                {JSON.stringify(obj, null, 2)}
              </Text>
            </Flex>
          </PopoverContent>
        )}
      </PopoverWrapper>
    </Flex>
  );
};

export function DeviceActionUI<
  Output,
  Error,
  IntermediateValue extends DeviceActionIntermediateValue,
>({
  lastResponse,
  deviceModelId,
}: DeviceActionUIProps<Output, Error, IntermediateValue>) {
  let deviceActionUi = null;
  if (!lastResponse) deviceActionUi = <Text>No Device Action running</Text>;
  else if ("error" in lastResponse)
    deviceActionUi = (
      <JSONTextPopin
        label="error"
        obj={lastResponse.error}
        color={deviceActionStatusToColor[DeviceActionStatus.Error]}
      />
    );
  else {
    const { deviceActionState } = lastResponse;
    const color = deviceActionStatusToColor[deviceActionState.status];
    switch (deviceActionState.status) {
      case DeviceActionStatus.Stopped:
        deviceActionUi = (
          <Text color={color}>Device Action execution stopped</Text>
        );
        break;
      case DeviceActionStatus.Completed: {
        const { output } = deviceActionState;
        deviceActionUi = (
          <JSONTextPopin
            label="Device Action execution completed"
            color={color}
            obj={output || "empty output"}
          />
        );
        break;
      }
      case DeviceActionStatus.Error: {
        const { error } = deviceActionState;
        deviceActionUi = (
          <JSONTextPopin
            label="Device Action execution ended with an error"
            color={color}
            obj={error}
          />
        );
        break;
      }
      case DeviceActionStatus.NotStarted:
        break;
      case DeviceActionStatus.Pending: {
        const { requiredUserInteraction, ...rest } =
          deviceActionState.intermediateValue;
        deviceActionUi = (
          <>
            <DeviceAnimation
              deviceModelId={deviceModelId}
              userInteractionRequired={requiredUserInteraction}
            />
            {Object.keys(rest).length !== 0 ? (
              <JSONTextPopin
                label="Device Action pending, extra intermediate value"
                color={color}
                obj={rest}
              />
            ) : null}
          </>
        );
        break;
      }
    }
  }

  return deviceActionUi;
}
