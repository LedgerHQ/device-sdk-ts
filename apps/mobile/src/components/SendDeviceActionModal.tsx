import React, { useCallback, useEffect, useState } from "react";
import { type DeviceActionProps } from "_common/types.ts";
import {
  SessionDeviceScreen,
  useIsMockServerSession,
} from "_components/SessionDeviceScreen";
import { useForm } from "_hooks/useForm";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider";
import { DeviceActionStatus } from "@ledgerhq/device-management-kit";
import { Icons, InfiniteLoader, Popin, Text } from "@ledgerhq/native-ui";
import styled from "styled-components/native";
// eslint-disable-next-line no-restricted-imports -- React Native provides a util.inspect polyfill.
import { inspect } from "util";

type SendDeviceActionModalProps = {
  deviceAction?: DeviceActionProps<any, any, any, any>;
  onClose: () => void;
  isOpen: boolean;
};

const OutputScrollView = styled.ScrollView`
  max-height: 300px;
`;

/** Small enough for the popin, which a running action cannot leave. */
const DeviceScreenContainer = styled.View`
  width: 220px;
  align-self: center;
  margin-top: 12px;
`;

export const SendDeviceActionModal: React.FC<SendDeviceActionModalProps> = ({
  deviceAction,
  onClose,
  isOpen,
}) => {
  const { formValues, setFormValue } = useForm(
    deviceAction?.initialValues || {},
  );
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const {
    state: { selectedId: deviceSessionId },
  } = useDeviceSessionsContext();
  const hasDeviceScreen = useIsMockServerSession(deviceSessionId);

  useEffect(() => {
    setOutput("");
  }, [isOpen]);

  useEffect(() => {
    if (deviceAction && deviceAction.initialValues) {
      Object.keys(deviceAction.initialValues).forEach(key => {
        setFormValue(key, deviceAction.initialValues[key]);
      });
    }
  }, [deviceAction, setFormValue]);
  const onSend = useCallback(async () => {
    let subscription = null;
    if (deviceAction) {
      setOutput("");
      setLoading(true);
      const { observable } = deviceAction.executeDeviceAction(formValues);
      subscription = observable.subscribe({
        next: response => {
          if (response.status === DeviceActionStatus.Error) {
            setOutput(inspect(response, { depth: null }));
          } else {
            setOutput(JSON.stringify(response, null, 2));
          }
        },
        complete: () => {
          setLoading(false);
        },
      });
    }
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [deviceAction, formValues]);

  return (
    <Popin
      Icon={<Icons.Experiment />}
      isOpen={isOpen}
      title={deviceAction?.title}
      subtitle="Try it"
      description={deviceAction?.description}
      onClose={onClose}
      onLeftButtonPress={onClose}
      leftButtonText="Cancel"
      onRightButtonPress={onSend}
      rightButtonText="Send">
      {loading && <InfiniteLoader />}
      {loading && deviceSessionId && hasDeviceScreen && (
        <DeviceScreenContainer>
          <SessionDeviceScreen sessionId={deviceSessionId} />
        </DeviceScreenContainer>
      )}
      {deviceAction && !loading && (
        <deviceAction.FormComponent
          values={formValues}
          setValue={setFormValue}
        />
      )}
      {output && (
        <OutputScrollView>
          <Text>{output}</Text>
        </OutputScrollView>
      )}
    </Popin>
  );
};
