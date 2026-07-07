/**
 * @file Mock Capture screen
 *
 * Records APDU exchanges captured passively from the host app DMK logs,
 * derives mock-server mocks from them, and lets the user download the
 * resulting session export or push it directly to a running mock server.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";
import {
  type DeviceApp,
  MockClient,
  type SessionExport,
} from "@ledgerhq/device-mockserver-client";
import styled from "styled-components";

import { type ApduExchange } from "../../hooks/useConnectorMessages";
import { NotConnectedMessage } from "../../shared/NotConnectedMessage";
import { deviceConfigFromSession } from "./deviceConfigFromSession";
import {
  type DeviceCaptureGroup,
  generateMultiDeviceSessionExport,
} from "./generateSessionExport";

const DEFAULT_MOCK_SERVER_URL = "http://127.0.0.1:8080";

const MOCK_CAPTURE_CODE_EXAMPLE = `import { DevToolsLogger } from "@ledgerhq/device-management-kit-devtools-core";

const dmk = new DeviceManagementKitBuilder()
  .addLogger(new DevToolsLogger(connector))
  .build();`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px;
  overflow: auto;
  height: 100%;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
`;

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #333;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #666;
  flex: 1;
  min-width: 140px;
`;

const Input = styled.input`
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: #2196f3;
  }
`;

const Button = styled.button<{ $variant?: "primary" | "danger" | "neutral" }>`
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: ${({ $variant }) =>
    $variant === "danger"
      ? "#e53935"
      : $variant === "neutral"
        ? "#757575"
        : "#2196f3"};

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const RecordingDot = styled.span<{ $active: boolean }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  background: ${({ $active }) => ($active ? "#fff" : "#bbb")};
`;

const Stat = styled.span`
  font-size: 12px;
  color: #555;
`;

const JsonEditor = styled.textarea`
  margin: 0;
  padding: 12px;
  background: #1e1e1e;
  color: #d4d4d4;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  min-height: 240px;
  max-height: 480px;
  overflow: auto;
  white-space: pre;
  resize: vertical;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 1px #2196f3;
  }
`;

const StatusMessage = styled.div<{ $error: boolean }>`
  font-size: 12px;
  padding: 8px;
  border-radius: 4px;
  background: ${({ $error }) => ($error ? "#ffebee" : "#e8f5e9")};
  border: 1px solid ${({ $error }) => ($error ? "#ffcdd2" : "#c8e6c9")};
  color: ${({ $error }) => ($error ? "#c62828" : "#2e7d32")};
`;

const Checkbox = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
`;

type MockCaptureProps = {
  apduExchanges: ApduExchange[];
  isRecording: boolean;
  isConnected: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  clearRecorded: () => void;
  sessionStates: Map<string, DeviceSessionState>;
  connectedDevices: ConnectedDevice[];
};

type PushStatus = { error: boolean; message: string } | null;

export const MockCapture: React.FC<MockCaptureProps> = ({
  apduExchanges,
  isRecording,
  isConnected,
  startRecording,
  stopRecording,
  clearRecorded,
  sessionStates,
  connectedDevices,
}) => {
  const [includeHandshake, setIncludeHandshake] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_MOCK_SERVER_URL);
  const [sessionToken, setSessionToken] = useState("");
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>(null);
  const [detectedApps, setDetectedApps] = useState<Map<string, DeviceApp[]>>(
    new Map(),
  );
  const [detectedFirmwareVersions, setDetectedFirmwareVersions] = useState<
    Map<string, string>
  >(new Map());

  useEffect(() => {
    for (const [sessionId, state] of sessionStates.entries()) {
      const config = deviceConfigFromSession(state);
      if (config.apps && config.apps.length > 0) {
        const seenApps = config.apps;
        setDetectedApps((prev) => {
          const current = prev.get(sessionId) ?? [];
          const merged = [...current];
          for (const app of seenApps) {
            if (
              !merged.some(
                (a) => a.name === app.name && a.version === app.version,
              )
            ) {
              merged.push(app);
            }
          }
          if (merged.length === current.length) return prev;
          return new Map(prev).set(sessionId, merged);
        });
      }
      if (config.firmware_version) {
        const firmwareVersion = config.firmware_version;
        setDetectedFirmwareVersions((prev) => {
          if (prev.get(sessionId)) return prev;
          return new Map(prev).set(sessionId, firmwareVersion);
        });
      }
    }
  }, [sessionStates]);

  const handleClear = useCallback(() => {
    clearRecorded();
    setDetectedApps(new Map());
    setDetectedFirmwareVersions(new Map());
  }, [clearRecorded]);

  // Group exchanges by the session (device) that performed them, preserving
  // first-seen order, so each connected device gets its own export entry.
  const captureGroups = useMemo<DeviceCaptureGroup[]>(() => {
    const exchangesBySession = new Map<string, ApduExchange[]>();
    for (const exchange of apduExchanges) {
      const sessionId = exchange.sessionId ?? "";
      const list = exchangesBySession.get(sessionId) ?? [];
      list.push(exchange);
      exchangesBySession.set(sessionId, list);
    }

    return [...exchangesBySession.entries()].map(([sessionId, exchanges]) => {
      const state = sessionId ? sessionStates.get(sessionId) : undefined;
      const connectivityType = sessionId
        ? connectedDevices.find((device) => device.sessionId === sessionId)
            ?.type
        : undefined;
      const base = deviceConfigFromSession(state, connectivityType);
      const firmwareVersion = detectedFirmwareVersions.get(sessionId);
      const apps = detectedApps.get(sessionId);
      const device = {
        ...base,
        name: base.name || "Mocked device",
        ...(firmwareVersion ? { firmware_version: firmwareVersion } : {}),
        ...(apps && apps.length > 0 ? { apps } : {}),
      };
      return { device, exchanges };
    });
  }, [
    apduExchanges,
    sessionStates,
    connectedDevices,
    detectedApps,
    detectedFirmwareVersions,
  ]);

  const sessionExport = useMemo(
    () => generateMultiDeviceSessionExport(captureGroups, { includeHandshake }),
    [captureGroups, includeHandshake],
  );

  const mockCount = sessionExport.devices.reduce(
    (total, device) => total + (device.mocks?.length ?? 0),
    0,
  );

  const generatedJson = useMemo(
    () => JSON.stringify(sessionExport, null, 2),
    [sessionExport],
  );

  // Editable JSON, kept in sync with the generated export until it changes
  // (e.g. new exchanges captured or the handshake toggle flipped), at which
  // point the editor is refreshed with the regenerated export.
  const [editedJson, setEditedJson] = useState(generatedJson);
  const lastGeneratedRef = useRef(generatedJson);
  useEffect(() => {
    if (generatedJson !== lastGeneratedRef.current) {
      lastGeneratedRef.current = generatedJson;
      setEditedJson(generatedJson);
    }
  }, [generatedJson]);

  const jsonError = useMemo(() => {
    try {
      JSON.parse(editedJson);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON";
    }
  }, [editedJson]);

  const downloadJson = useCallback(() => {
    const blob = new Blob([editedJson], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mock-session-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editedJson]);

  const pushToServer = useCallback(async () => {
    setIsPushing(true);
    setPushStatus(null);
    try {
      const parsedExport = JSON.parse(editedJson) as SessionExport;
      const client = new MockClient(
        serverUrl,
        sessionToken ? { token: sessionToken } : {},
      );
      if (!sessionToken) {
        await client.authenticate();
      }
      const result = await client.importSession(parsedExport);
      const importedMocks = result.devices.reduce(
        (total, device) => total + (device.mocks?.length ?? 0),
        0,
      );
      setPushStatus({
        error: false,
        message: `Imported ${result.devices.length} device(s) with ${importedMocks} mock(s) to the mock server.`,
      });
    } catch (error) {
      setPushStatus({
        error: true,
        message:
          error instanceof Error ? error.message : "Failed to push session",
      });
    } finally {
      setIsPushing(false);
    }
  }, [serverUrl, sessionToken, editedJson]);

  if (!isConnected) {
    return (
      <NotConnectedMessage
        title="Logger not connected"
        description={
          <>
            Mock capture reads APDU exchanges from the DMK logs. Add{" "}
            <code>DevToolsLogger</code> to your DMK builder to start capturing:
          </>
        }
        codeExample={MOCK_CAPTURE_CODE_EXAMPLE}
      />
    );
  }

  const hasExchanges = apduExchanges.length > 0;

  return (
    <Container>
      <Section>
        <SectionTitle>Recording</SectionTitle>
        <Row>
          {isRecording ? (
            <Button $variant="danger" onClick={stopRecording}>
              <RecordingDot $active />
              Stop
            </Button>
          ) : (
            <Button $variant="primary" onClick={startRecording}>
              <RecordingDot $active={false} />
              Record
            </Button>
          )}
          <Button
            $variant="neutral"
            onClick={handleClear}
            disabled={!hasExchanges}
          >
            Clear
          </Button>
          <Stat>
            {apduExchanges.length} exchange(s) captured, {mockCount} mock(s)
            derived
          </Stat>
        </Row>
        <Checkbox>
          <input
            type="checkbox"
            checked={includeHandshake}
            onChange={(e) => setIncludeHandshake(e.target.checked)}
          />
          Include handshake APDUs (GetOsVersion / GetAppAndVersion)
        </Checkbox>
      </Section>

      <Section>
        <SectionTitle>Generated session export</SectionTitle>
        <Row>
          <Button
            onClick={downloadJson}
            disabled={!hasExchanges || !!jsonError}
          >
            Download JSON
          </Button>
        </Row>
        <JsonEditor
          value={editedJson}
          spellCheck={false}
          onChange={(e) => setEditedJson(e.target.value)}
        />
        {jsonError && (
          <StatusMessage $error>Invalid JSON: {jsonError}</StatusMessage>
        )}
      </Section>

      <Section>
        <SectionTitle>Push to mock server</SectionTitle>
        <Row>
          <Field>
            Server URL
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
          </Field>
          <Field>
            Session token
            <Input
              value={sessionToken}
              placeholder="auto-provisioned if empty"
              onChange={(e) => setSessionToken(e.target.value)}
            />
          </Field>
        </Row>
        <Row>
          <Button
            onClick={pushToServer}
            disabled={!hasExchanges || isPushing || !!jsonError}
          >
            {isPushing ? "Pushing..." : "Push to mock server"}
          </Button>
        </Row>
        {pushStatus && (
          <StatusMessage $error={pushStatus.error}>
            {pushStatus.message}
          </StatusMessage>
        )}
      </Section>
    </Container>
  );
};
