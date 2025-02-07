import React, { useCallback, useEffect, useState } from "react";
import { Icons, InfiniteLoader, Popin, Text } from "@ledgerhq/native-ui";
import { useForm } from "_hooks/useForm";
import { View } from "react-native";
import { CommandProps } from "_common/types.ts";

type SendCommandModalProps = {
  command?: CommandProps<any, any, any>;
  onClose: () => void;
  isOpen: boolean;
};

export const SendCommandModal: React.FC<SendCommandModalProps> = ({
  command,
  onClose,
  isOpen,
}) => {
  const { formValues, setFormValue } = useForm(command?.initialValues);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  useEffect(() => {
    setOutput("");
    if (command && command.initialValues) {
      Object.keys(command.initialValues).forEach(key => {
        setFormValue(key, command.initialValues[key]);
      });
    }
  }, [command, setFormValue]);
  const onSend = useCallback(async () => {
    setOutput("");
    if (command) {
      setLoading(true);
      const response = await command.sendCommand(formValues);
      setOutput(JSON.stringify(response));
      setLoading(false);
    }
  }, [command, formValues]);

  return (
    <Popin
      Icon={<Icons.Experiment />}
      isOpen={isOpen}
      title={command?.title}
      subtitle="Try it"
      description={command?.description}
      onClose={onClose}
      onLeftButtonPress={onClose}
      leftButtonText="Cancel"
      onRightButtonPress={onSend}
      rightButtonText="Send command">
      {loading && <InfiniteLoader />}
      {command && !loading && (
        <command.FormComponent values={formValues} setValue={setFormValue} />
      )}
      {output && (
        <View>
          <Text>{output}</Text>
        </View>
      )}
    </Popin>
  );
};
