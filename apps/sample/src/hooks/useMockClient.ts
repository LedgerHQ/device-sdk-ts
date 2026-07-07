import { useEffect, useState } from "react";
import { MockClient } from "@ledgerhq/device-mockserver-client";

/**
 * Build a MockClient pointing at the mock server. When a `token` is provided the
 * client operates within that shared session; otherwise it lazily
 * provisions its own session via /auth.
 */
export const useMockClient = (url: string, token?: string): MockClient => {
  const [client, setClient] = useState(
    () => new MockClient(url, { token: token || undefined }),
  );

  useEffect(() => {
    setClient(new MockClient(url, { token: token || undefined }));
  }, [url, token]);

  return client;
};
