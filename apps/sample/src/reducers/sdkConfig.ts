import { Reducer } from "react";
import { BuiltinTransports } from "@ledgerhq/device-management-kit";

export type SdkConfigState = {
  mockServerUrl: string;
  transport: BuiltinTransports;
};

type SetTransportAction = {
  type: "set_transport";
  payload: {
    transport: BuiltinTransports;
  };
};

type SetMockServerUrlAction = {
  type: "set_mock_server_url";
  payload: {
    mockServerUrl: string;
  };
};

export type SdkConfigAction = SetTransportAction | SetMockServerUrlAction;

export const SdkConfigInitialState: SdkConfigState = {
  mockServerUrl: "http://127.0.0.1:8080/",
  transport:
    (process.env.SDK_CONFIG_TRANSPORT as BuiltinTransports) ||
    BuiltinTransports.USB,
};

export const sdkConfigReducer: Reducer<SdkConfigState, SdkConfigAction> = (
  state,
  action,
) => {
  switch (action.type) {
    case "set_transport":
      return {
        ...state,
        transport: action.payload.transport,
      };
    case "set_mock_server_url":
      return {
        ...state,
        mockServerUrl: action.payload.mockServerUrl,
      };

    default:
      return state;
  }
};
