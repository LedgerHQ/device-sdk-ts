import React, { useCallback, useEffect, useMemo, useState } from "react";
import { type CommandProps, type ThemeProps } from "_common/types.ts";
import { getCommands } from "_components/Commands.tsx";
import { DeviceStateView } from "_components/DeviceStateView.tsx";
import { SendCommandModal } from "_components/SendCommandModal.tsx";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider.tsx";
import { useDmk } from "_providers/dmkProvider.tsx";
import { Flex, SelectableList } from "@ledgerhq/native-ui";
import { useNavigation } from "@react-navigation/native";
import styled from "styled-components/native";

import { DisconnectButton } from "./DisconnectButton";

const SafeView = styled.SafeAreaView`
  flex: 1;
`;
const Container = styled(Flex)<ThemeProps>`
  background-color: ${({ theme }) => theme.colors.background.main};
  flex: 1;
  padding: 16px;
  justify-content: space-between;
`;

export const CommandTesterScreen: React.FC = () => {
  const dmk = useDmk();
  const {
    state: { selectedId: deviceSessionId },
  } = useDeviceSessionsContext();
  const navigation = useNavigation();

  useEffect(() => {
    if (!deviceSessionId) {
      navigation.goBack();
    }
  }, [deviceSessionId, navigation]);
  const commands = useMemo(() => {
    if (deviceSessionId) {
      return getCommands(dmk, deviceSessionId);
    }
    return [];
  }, [deviceSessionId, dmk]);
  const [selectedCommand, selectCommand] =
    useState<CommandProps<any, any, any>>();
  const onSelect = useCallback(
    (commandId: string) => {
      const command = commands.find(c => c.id === commandId);
      selectCommand(command);
      setCommandModalVisibility(true);
    },
    [commands],
  );
  const [isCommandModalVisible, setCommandModalVisibility] = useState(false);
  const onClose = useCallback(() => {
    setCommandModalVisibility(false);
    selectCommand(undefined);
  }, []);

  if (!deviceSessionId) {
    return null;
  }

  return (
    <SafeView>
      <Container>
        <SelectableList currentValue={selectedCommand?.id} onChange={onSelect}>
          {commands.map(command => (
            <SelectableList.Element key={command.id} value={command.id}>
              {command.title}
            </SelectableList.Element>
          ))}
        </SelectableList>
        <SendCommandModal
          command={selectedCommand}
          onClose={onClose}
          isOpen={isCommandModalVisible}
        />
        <Flex rowGap={6}>
          <DeviceStateView sessionId={deviceSessionId} />
          <DisconnectButton sessionId={deviceSessionId} />
        </Flex>
      </Container>
    </SafeView>
  );
};
