import { FrontController } from "@ldmk/app/FrontController";
import { SendApduActionHandler } from "@ldmk/app/handlers/apdu/SendApduActionHandler";
import { ExitActionHandler } from "@ldmk/app/handlers/cli/ExitActionHandler";
import { ConnectDeviceActionHandler } from "@ldmk/app/handlers/device/ConnectDeviceActionHandler";
import { DisconnectDeviceActionHandler } from "@ldmk/app/handlers/device/DisconnectDeviceActionHandler";
import { ListDevicesActionHandler } from "@ldmk/app/handlers/device/ListDevicesActionHandler";
import { ExecuteDeviceActionActionHandler } from "@ldmk/app/handlers/device-action/ExecuteDeviceActionActionHandler";
import { GetDeviceMetadataDeviceActionHandler } from "@ldmk/app/handlers/device-action/handlers/GetDeviceMetadataDeviceActionHandler";
import { GetDeviceStatusDeviceActionHandler } from "@ldmk/app/handlers/device-action/handlers/GetDeviceStatusDeviceActionHandler";
import { GoToDashboardDeviceActionHandler } from "@ldmk/app/handlers/device-action/handlers/GoToDashboardDeviceActionHandler";
import { ListAppsDeviceActionHandler } from "@ldmk/app/handlers/device-action/handlers/ListAppsDeviceActionHandler";
import { OpenAppDeviceActionHandler } from "@ldmk/app/handlers/device-action/handlers/OpenAppDeviceActionHandler";
import { CloseAppCommandHandler } from "@ldmk/app/handlers/device-command/handlers/CloseAppCommandHandler";
import { GetAppAndVersionCommandHandler } from "@ldmk/app/handlers/device-command/handlers/GetAppAndVersionCommandHandler";
import { GetBatteryStatusCommandHandler } from "@ldmk/app/handlers/device-command/handlers/GetBatteryStatusCommandHandler";
import { GetOsVersionCommandHandler } from "@ldmk/app/handlers/device-command/handlers/GetOsVersionCommandHandler";
import { ListAppsCommandHandler } from "@ldmk/app/handlers/device-command/handlers/ListAppsCommandHandler";
import { OpenAppCommandHandler } from "@ldmk/app/handlers/device-command/handlers/OpenAppCommandHandler";
import { SendDeviceCommandActionHandler } from "@ldmk/app/handlers/device-command/SendDeviceCommandActionHandler";
import { GetAddressEthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/GetAddressEthSignerActionHandler";
import { SignDelegationAuthorizationEthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/SignDelegationAuthorizationEthSignerActionHandler";
import { SignMessageEthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/SignMessageEthSignerActionHandler";
import { SignTransactionEthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/SignTransactionEthSignerActionHandler";
import { SignTypedDataEthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/SignTypedDataEthSignerActionHandler";
import { VerifySafeAddressEthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/VerifySafeAddressEthSignerAction";
import { UseEthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/UseEthSignerActionHandler";
import { UseSignerActionHandler } from "@ldmk/app/handlers/signer/UseSignerActionHandler";
import { AppState } from "@ldmk/app/state/AppState";
import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit";
import {
  DevToolsDmkInspector,
  DevToolsLogger,
} from "@ledgerhq/device-management-kit-devtools-core";
import { DEFAULT_CLIENT_WS_URL } from "@ledgerhq/device-management-kit-devtools-websocket-common";
import { DevToolsWebSocketConnector } from "@ledgerhq/device-management-kit-devtools-websocket-connector";
import { nodeHidTransportFactory } from "@ledgerhq/device-transport-kit-node-hid";
import { ContainerModule } from "inversify";

import { appTypes } from "./app.types";

export const appModule = new ContainerModule(({ bind }) => {
  // DMK Instance
  bind(appTypes.DMKInstance)
    .toDynamicValue(() => {
      const devToolsWebSocketConnector =
        DevToolsWebSocketConnector.getInstance().connect({
          url: DEFAULT_CLIENT_WS_URL,
        });

      const devToolsLogger = new DevToolsLogger(devToolsWebSocketConnector);

      const dmkInstance = new DeviceManagementKitBuilder()
        .addTransport(nodeHidTransportFactory)
        .addLogger(devToolsLogger)
        .build();

      new DevToolsDmkInspector(devToolsWebSocketConnector, dmkInstance);

      return dmkInstance;
    })
    .inSingletonScope();
  // App State
  bind(appTypes.AppState).to(AppState).inSingletonScope();
  // Front Controller
  bind(appTypes.FrontController).to(FrontController);
  // CLI Actions
  bind(appTypes.ActionHandler).to(ListDevicesActionHandler);
  bind(appTypes.ActionHandler).to(ConnectDeviceActionHandler);
  bind(appTypes.ActionHandler).to(SendApduActionHandler);
  bind(appTypes.ActionHandler).to(SendDeviceCommandActionHandler);
  bind(appTypes.ActionHandler).to(ExecuteDeviceActionActionHandler);
  bind(appTypes.ActionHandler).to(UseSignerActionHandler);
  bind(appTypes.ActionHandler).to(DisconnectDeviceActionHandler);
  bind(appTypes.ActionHandler).to(ExitActionHandler);
  // Device Commands
  bind(appTypes.DeviceCommandHandler).to(GetOsVersionCommandHandler);
  bind(appTypes.DeviceCommandHandler).to(GetAppAndVersionCommandHandler);
  bind(appTypes.DeviceCommandHandler).to(GetBatteryStatusCommandHandler);
  bind(appTypes.DeviceCommandHandler).to(ListAppsCommandHandler);
  bind(appTypes.DeviceCommandHandler).to(OpenAppCommandHandler);
  bind(appTypes.DeviceCommandHandler).to(CloseAppCommandHandler);
  // Device Actions
  bind(appTypes.DeviceActionHandler).to(GetDeviceStatusDeviceActionHandler);
  bind(appTypes.DeviceActionHandler).to(GoToDashboardDeviceActionHandler);
  bind(appTypes.DeviceActionHandler).to(OpenAppDeviceActionHandler);
  bind(appTypes.DeviceActionHandler).to(ListAppsDeviceActionHandler);
  bind(appTypes.DeviceActionHandler).to(GetDeviceMetadataDeviceActionHandler);
  // Signer Actions
  bind(appTypes.SignerActionHandler).to(UseEthSignerActionHandler);
  // Eth Signer Actions
  bind(appTypes.EthSignerActionHandler).to(GetAddressEthSignerActionHandler);
  bind(appTypes.EthSignerActionHandler).to(
    VerifySafeAddressEthSignerActionHandler,
  );
  bind(appTypes.EthSignerActionHandler).to(SignMessageEthSignerActionHandler);
  bind(appTypes.EthSignerActionHandler).to(
    SignTransactionEthSignerActionHandler,
  );
  bind(appTypes.EthSignerActionHandler).to(SignTypedDataEthSignerActionHandler);
  bind(appTypes.EthSignerActionHandler).to(
    SignDelegationAuthorizationEthSignerActionHandler,
  );
});
