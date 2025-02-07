import React, { useCallback, useEffect, useState } from "react";
import { Icons, InfiniteLoader, Popin, Text } from "@ledgerhq/native-ui";
import { useForm } from "_hooks/useForm";
import { View } from "react-native";
import { DeviceActionProps } from "_common/types.ts";
import { lastValueFrom } from "rxjs";

type SendDeviceActionModalProps = {
  deviceAction?: DeviceActionProps<any, any, any, any>;
  onClose: () => void;
  isOpen: boolean;
};

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
    if (deviceAction && deviceAction.initialValues) {
      Object.keys(deviceAction.initialValues).forEach(key => {
        setFormValue(key, deviceAction.initialValues[key]);
      });
    }
  }, [deviceAction, setFormValue]);
  const onSend = useCallback(async () => {
    setOutput("");
    if (deviceAction) {
      setLoading(true);
      const { observable } = deviceAction.executeDeviceAction(formValues);
      const response = await lastValueFrom(observable);
      setOutput(JSON.stringify(response));
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
      rightButtonText="Send device action">
      {loading && <InfiniteLoader />}
      {deviceAction && !loading && (
        <deviceAction.FormComponent
          values={formValues}
          setValue={setFormValue}
        />
      )}
      {output && (
        <View>
          <Text>{output}</Text>
        </View>
      )}
    </Popin>
  );
};
