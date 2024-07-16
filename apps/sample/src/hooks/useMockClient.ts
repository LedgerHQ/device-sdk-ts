import { createContext, useContext } from "react";
import { MockClient } from "@ledgerhq/device-sdk-transport-mock";

export const client = new MockClient("http://127.0.0.1:8080/");
const MockClientContext = createContext<MockClient>(client);

export const useMockClient = (): MockClient => {
  return useContext(MockClientContext);
};
