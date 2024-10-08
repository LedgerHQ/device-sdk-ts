import React from "react";
import Lottie from "react-lottie";
import {
  type DeviceActionIntermediateValue,
  DeviceActionStatus,
  DeviceModelId,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import {
  Flex,
  InfiniteLoader,
  Link,
  Tag,
  Text,
  Tooltip,
} from "@ledgerhq/react-ui";
import styled from "styled-components";

import * as PinFlexDark from "./lotties/flex/01_EUROPA_DARK_PIN.json";
import * as PairingFlexDark from "./lotties/flex/02_EUROPA_DARK_PAIRING.json";
import * as PairedSuccessFlexDark from "./lotties/flex/03_EUROPA_DARK_PAIRED_SUCCESS.json";
import * as ContinueOnLedgerFlexDark from "./lotties/flex/04_EUROPA_DARK_CONTINUE_ON_LEDGER.json";
import * as SignTransactionFlexDark from "./lotties/flex/05_EUROPA_DARK_SIGN_TRANSACTION.json";
import * as FrontViewFlexDark from "./lotties/flex/06_STAX_DARK_FRONT_VIEW.json";
import * as PinNanoSDark from "./lotties/nanosp/01_NANO_S_DARK_PIN.json";
import * as ContinueOnLedgerNanoSDark from "./lotties/nanosp/02_NANO_S_DARK_CONTINUE_ON_YOUR_LEDGER.json";
import * as PinNanoXDark from "./lotties/nanox/01_NANO_X_DARK_PIN.json";
import * as PairingNanoXDark from "./lotties/nanox/02_NANO_X_DARK_PAIRING.json";
import * as ContinueOnLedgerNanoXDark from "./lotties/nanox/03_NANO_X_DARK_CONTINUE_ON_YOUR_LEDGER.json";
import * as PinStaxDark from "./lotties/stax/01_STAX_DARK_PIN.json";
import * as PairingStaxDark from "./lotties/stax/02_STAX_DARK_PAIRING.json";
import * as PairedSuccessStaxDark from "./lotties/stax/03_STAX_DARK_PAIRED_SUCCESS.json";
import * as ContinueOnLedgerStaxDark from "./lotties/stax/04_STAX_DARK_CONTINUE_ON_LEDGER.json";
import * as SignTransactionStaxDark from "./lotties/stax/05_STAX_DARK_SIGN_TRANSACTION.json";
import * as FrontViewStaxDark from "./lotties/stax/06_STAX_DARK_FRONT_VIEW.json";
import {
  DeviceActionResponseProps,
  deviceActionStatusToColor,
} from "./DeviceActionResponse";

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

const DeviceAnimation: React.FC<DeviceAnimationProps> = ({
  userInteractionRequired,
  deviceModelId,
}) => {
  const animationKey =
    UserInteractionToAnimationKeyMap[userInteractionRequired];
  const animationData = animationKey
    ? animationDataMap[deviceModelId][animationKey]
    : null;
  const WarningText = styled(Text).attrs({ mb: 4 })``;
  return (
    <>
      {animationData ? (
        <Lottie
          options={{ animationData, autoplay: true, loop: true }}
          height={200}
          width={200}
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

const JSONTextPopin: React.FC<{
  label: string;
  obj: unknown;
  color: string;
}> = ({ label, obj, color }) => {
  return (
    <Flex flexDirection="column" alignItems="center" rowGap={5}>
      <Text color={color} textAlign="center">
        {label}
      </Text>
      <Tooltip
        placement="top"
        interactive
        maxWidth={"100%"}
        trigger="click"
        content={
          <Flex overflow="scroll" maxHeight="400px">
            <Text color="neutral.c00" whiteSpace="pre-wrap">
              {JSON.stringify(obj, null, 2)}
            </Text>
          </Flex>
        }
      >
        <Link type="shade">{"\nClick to reveal value"}</Link>
      </Tooltip>
    </Flex>
  );
};

export default function DeviceActionUI<
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
