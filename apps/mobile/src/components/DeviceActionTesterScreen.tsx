import { useDmk } from "_providers/dmkProvider.tsx";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider.tsx";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RootScreens } from "_navigators/RootNavigator.constants.ts";
import { DeviceActionProps, ThemeProps } from "_common/types.ts";
import { SelectableList } from "@ledgerhq/native-ui";
import styled from "styled-components/native";
import { getDeviceActions } from "_components/DeviceActions.tsx";
import { SendDeviceActionModal } from "_components/SendDeviceActionModal.tsx";
import { useNavigation } from "@react-navigation/native";

const Container = styled.SafeAreaView<ThemeProps>`
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
  const { navigate } = useNavigation();

  useEffect(() => {
    if (!deviceSessionId) {
      navigate(RootScreens.Home);
    }
  }, [deviceSessionId, navigate]);
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

  return (
    <Container>
      <SelectableList
        currentValue={selectedDeviceAction?.id}
        onChange={onSelect}>
        {deviceActions.map(deviceAction => (
          <SelectableList.Element key={deviceAction.id} value={deviceAction.id}>
            {deviceAction.title}
          </SelectableList.Element>
        ))}
      </SelectableList>
      <SendDeviceActionModal
        deviceAction={selectedDeviceAction}
        onClose={onClose}
        isOpen={isDeviceActionModalVisible}
      />
    </Container>
  );
};
