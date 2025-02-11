import React, { useCallback, useEffect, useState } from "react";
import { Icons, InfiniteLoader, Popin, Text } from "@ledgerhq/native-ui";
import { useForm } from "_hooks/useForm";
import { DeviceActionProps } from "_common/types.ts";
import { lastValueFrom } from "rxjs";
import { inspect } from "util";
import { DeviceActionStatus } from "@ledgerhq/device-management-kit";
import styled from "styled-components/native";

type SendDeviceActionModalProps = {
  deviceAction?: DeviceActionProps<any, any, any, any>;
  onClose: () => void;
  isOpen: boolean;
};

const OutputScrollView = styled.ScrollView`
  max-height: 300px;
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
    if (deviceAction) {
      setOutput("");
      setLoading(true);
      const { observable } = deviceAction.executeDeviceAction(formValues);
      const response = await lastValueFrom(observable);
      if (response.status === DeviceActionStatus.Error) {
        setOutput(inspect(response, { depth: null }));
      } else {
        setOutput(JSON.stringify(response, null, 2));
      }
      setLoading(false);
    }
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
