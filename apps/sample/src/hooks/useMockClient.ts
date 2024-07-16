import { useEffect, useState } from "react";
import { MockClient } from "@ledgerhq/device-sdk-transport-mock";

export const useMockClient = (url: string): MockClient => {
  const [client, setClient] = useState(new MockClient(url));

  console.log("use mock client ", url);
  useEffect(() => {
    setClient(new MockClient(url));
  }, [url]);

  return client;
};
