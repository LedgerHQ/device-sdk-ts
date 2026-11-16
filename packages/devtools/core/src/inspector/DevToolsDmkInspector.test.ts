import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { MODULE_CONNECTED_MESSAGE_TYPE } from "../modules";
import { type Connector } from "../types";
import { INSPECTOR_MESSAGE_TYPES } from "./constants";
import { DevToolsDmkInspector } from "./DevToolsDmkInspector";

vi.mock("./deviceObserver", () => ({
  createDeviceObserver: () => () => undefined,
}));
vi.mock("./DiscoveryHandler", () => ({
  DiscoveryHandler: class {
    destroy() {}
  },
}));

const makeConnector = () => {
  const sendMessage = vi.fn();
  const unsubscribe = vi.fn();
  const connector: Connector = {
    sendMessage,
    listenToMessages: vi.fn(() => ({ unsubscribe })),
  };
  return { connector, sendMessage, unsubscribe };
};

const dmk = {} as DeviceManagementKit;

const mockServerMessages = (sendMessage: ReturnType<typeof vi.fn>) =>
  sendMessage.mock.calls.filter(
    ([type]) => type === INSPECTOR_MESSAGE_TYPES.MOCK_SERVER_CONFIG,
  );

describe("DevToolsDmkInspector", () => {
  it("introduces itself to the dashboard", () => {
    const { connector, sendMessage } = makeConnector();
    new DevToolsDmkInspector(connector, dmk);
    expect(sendMessage).toHaveBeenCalledWith(
      MODULE_CONNECTED_MESSAGE_TYPE,
      JSON.stringify({ module: "dmk-inspector" }),
    );
  });

  it("shares the mock server it is given", () => {
    const { connector, sendMessage } = makeConnector();
    new DevToolsDmkInspector(connector, dmk, {
      mockServer: { url: "http://localhost:9752", sessionToken: "t" },
    });
    expect(mockServerMessages(sendMessage)).toEqual([
      [
        INSPECTOR_MESSAGE_TYPES.MOCK_SERVER_CONFIG,
        '{"url":"http://localhost:9752","sessionToken":"t"}',
      ],
    ]);
  });

  it("sends null without a mock server, so the dashboard drops a previous one", () => {
    const { connector, sendMessage } = makeConnector();
    new DevToolsDmkInspector(connector, dmk);
    expect(mockServerMessages(sendMessage)).toEqual([
      [INSPECTOR_MESSAGE_TYPES.MOCK_SERVER_CONFIG, "null"],
    ]);
  });

  it("stops listening to the dashboard when destroyed", () => {
    const { connector, unsubscribe } = makeConnector();
    new DevToolsDmkInspector(connector, dmk).destroy();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
