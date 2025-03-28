import { useDmk } from "_providers/dmkProvider.tsx";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider.tsx";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DeviceActionProps, ThemeProps } from "_common/types.ts";
import { Flex, SelectableList } from "@ledgerhq/native-ui";
import styled from "styled-components/native";
import { getDeviceActions } from "_components/DeviceActions.tsx";
import { SendDeviceActionModal } from "_components/SendDeviceActionModal.tsx";
import { DeviceStateView } from "_components/DeviceStateView.tsx";
import { useNavigation } from "@react-navigation/native";
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

export const DeviceActionTesterScreen = () => {
  const dmk = useDmk();
  const {
    state: { selectedId: deviceSessionId, deviceById },
  } = useDeviceSessionsContext();
  const navigation = useNavigation();

  useEffect(() => {
    if (!deviceSessionId) {
      navigation.goBack();
    }
  }, [deviceSessionId, navigation]);
  const deviceActions = useMemo(() => {
    if (deviceSessionId) {
      return getDeviceActions(
        dmk,
        deviceSessionId,
        deviceById[deviceSessionId].modelId,
      );
    }
    return [];
  }, [deviceById, deviceSessionId, dmk]);
  const [selectedDeviceAction, selectDeviceAction] =
    useState<DeviceActionProps<any, any, any, any>>();
  const onSelect = useCallback(
    (deviceActionId: string) => {
      const deviceAction = deviceActions.find(da => da.id === deviceActionId);
      selectDeviceAction(deviceAction);
      setDeviceActionModalVisibility(true);
    },
    [deviceActions],
  );
  const [isDeviceActionModalVisible, setDeviceActionModalVisibility] =
    useState(false);
  const onClose = useCallback(() => {
    setDeviceActionModalVisibility(false);
    selectDeviceAction(undefined);
  }, []);

  if (!deviceSessionId) {
    return null;
  }

  return (
    <SafeView>
      <Container>
        <SelectableList
          currentValue={selectedDeviceAction?.id}
          onChange={onSelect}>
          {deviceActions.map(deviceAction => (
            <SelectableList.Element
              key={deviceAction.id}
              value={deviceAction.id}>
              {deviceAction.title}
            </SelectableList.Element>
          ))}
        </SelectableList>
        <SendDeviceActionModal
          deviceAction={selectedDeviceAction}
          onClose={onClose}
          isOpen={isDeviceActionModalVisible}
        />
        <Flex rowGap={6}>
          <DeviceStateView sessionId={deviceSessionId} />
          <DisconnectButton sessionId={deviceSessionId} />
        </Flex>
      </Container>
    </SafeView>
  );
};
