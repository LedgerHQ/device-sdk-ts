import { type Reducer } from "react";
import { type TransportIdentifier } from "@ledgerhq/device-management-kit";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";

export type DmkConfigState = {
  mockServerUrl: string;
  transport: TransportIdentifier;
  speculosUrl?: string;
};

type SetTransportAction = {
  type: "set_transport";
  payload: {
    transport: string;
    speculosUrl?: string;
  };
};

type SetMockServerUrlAction = {
  type: "set_mock_server_url";
  payload: {
    mockServerUrl: string;
  };
};

export type DmkConfigAction = SetTransportAction | SetMockServerUrlAction;

export const DmkConfigInitialState: DmkConfigState = {
  mockServerUrl: "http://127.0.0.1:8080/",
  transport: process.env.Dmk_CONFIG_TRANSPORT || webHidIdentifier,
};

export const dmkConfigReducer: Reducer<DmkConfigState, DmkConfigAction> = (
  state,
  action,
) => {
  switch (action.type) {
    case "set_transport":
      return {
        ...state,
        transport: action.payload.transport,
        speculosUrl: action.payload.speculosUrl,
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
