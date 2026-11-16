import React, {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type DeviceConfig,
  MockClient,
} from "@ledgerhq/device-mockserver-client";

export const DEFAULT_MOCK_SERVER_URL =
  "https://device-mock-server.aws.ldg-ps-default.ldg-tech.com";

/**
 * What a new session starts with, so a scan finds a device whose screen can be
 * driven at once: a touch model, with an app Speculos runs on its firmware.
 */
const SEED_DEVICE: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  firmware_version: "1.11.0",
  apps: [{ name: "Bitcoin", version: "2.5.1" }],
};

/** A new session, with its seed device. A failed seed leaves it empty. */
const createSession = async (client: MockClient): Promise<string> => {
  const token = await client.authenticate();
  await client.addDevice(SEED_DEVICE).catch((error: unknown) => {
    console.warn("[mockServer] could not add the seed device", error);
  });
  return token;
};

/**
 * The mock server session the app's transport and device screens share. The
 * transport would otherwise create a session of its own, whose token nothing
 * else could read.
 */
export type MockServerSession =
  | { status: "connecting"; url: string }
  | { status: "ready"; url: string; token: string }
  | { status: "error"; url: string; error: string };

type MockServerContextType = {
  session: MockServerSession;
  /** Joins the session of `token`, or creates a new one when it is empty. */
  selectSession: (url: string, token?: string) => void;
};

const MockServerContext = createContext<MockServerContextType | null>(null);

const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const MockServerProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [request, setRequest] = useState<{ url: string; token?: string }>({
    url: DEFAULT_MOCK_SERVER_URL,
  });
  const [session, setSession] = useState<MockServerSession>({
    status: "connecting",
    url: DEFAULT_MOCK_SERVER_URL,
  });

  useEffect(() => {
    const { url, token } = request;
    let cancelled = false;
    setSession({ status: "connecting", url });
    const client = new MockClient(url, { token });
    // Reading the session checks a given token; without one, it creates one.
    (token ? client.getSession().then(() => token) : createSession(client))
      .then(ready => {
        if (!cancelled) setSession({ status: "ready", url, token: ready });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setSession({ status: "error", url, error: describe(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  const selectSession = useCallback((url: string, token?: string) => {
    setRequest({ url: url.trim(), token: token?.trim() || undefined });
  }, []);

  return (
    <MockServerContext.Provider value={{ session, selectSession }}>
      {children}
    </MockServerContext.Provider>
  );
};

export const useMockServer = (): MockServerContextType => {
  const context = useContext(MockServerContext);
  if (context === null) {
    throw new Error("useMockServer must be used within a MockServerProvider");
  }
  return context;
};
