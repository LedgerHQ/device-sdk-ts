import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDmk } from "_providers/dmkProvider.tsx";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider.tsx";
import { useNavigation } from "@react-navigation/native";
import { Flex, SelectableList } from "@ledgerhq/native-ui";
import { getCommands } from "_components/Commands.tsx";
import styled from "styled-components/native";
import { CommandProps, ThemeProps } from "_common/types.ts";
import { SendCommandModal } from "_components/SendCommandModal.tsx";
import { RootScreens } from "_navigators/RootNavigator.constants.ts";
import { DeviceStateView } from "./DeviceStateView";

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
  const { navigate } = useNavigation();

  useEffect(() => {
    if (!deviceSessionId) {
      navigate(RootScreens.Home);
    }
  }, [deviceSessionId, navigate]);
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
        <DeviceStateView sessionId={deviceSessionId} />
      </Container>
    </SafeView>
  );
};
