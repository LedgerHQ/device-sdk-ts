import { Reducer } from "react";

export type MockServerState = {
  enabled: boolean;
  url: string;
};

type EnableMockServerAction = {
  type: "enable_mock_server";
};

type DisableMockServerAction = {
  type: "disable_mock_server";
};

type SetMockServerUrlAction = {
  type: "set_mock_server_url";
  payload: {
    url: string;
  };
};

export type MockServerAction =
  | EnableMockServerAction
  | DisableMockServerAction
  | SetMockServerUrlAction;

export const MockServerInitialState = {
  url: "http://127.0.0.1:8080/",
  enabled: false,
};

export const mockServerReducer: Reducer<MockServerState, MockServerAction> = (
  state,
  action,
) => {
  switch (action.type) {
    case "enable_mock_server":
      return {
        ...state,
        enabled: true,
      };
    case "disable_mock_server":
      return {
        ...state,
        enabled: false,
      };
    case "set_mock_server_url":
      return {
        ...state,
        url: action.payload.url,
      };

    default:
      return state;
  }
};
