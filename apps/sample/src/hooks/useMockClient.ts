import { useEffect, useState } from "react";
import { MockClient } from "@ledgerhq/device-transport-kit-mock-client";

export const useMockClient = (url: string): MockClient => {
  const [client, setClient] = useState(new MockClient(url));

  useEffect(() => {
    setClient(new MockClient(url));
  }, [url]);

  return client;
};
