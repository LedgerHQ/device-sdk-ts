import React, { useCallback, useMemo } from "react";
import { Divider, Flex } from "@ledgerhq/react-ui";

import { NotConnectedMessage } from "../../shared/NotConnectedMessage";
import { LoggerToolbar } from "./LoggerToolbar";
import { LogsTable } from "./logsTable";
import { type LogData } from "./types";
import { useLogsDataAndOptions } from "./useLogsDataAndOptions";

type Props = {
  logs: Array<LogData>;
  clearLogs: () => void;
  isConnected?: boolean;
};

const LOGGER_CODE_EXAMPLE = `import { DevToolsLogger } from "@ledgerhq/device-management-kit-devtools-core";

const dmk = new DeviceManagementKitBuilder()
  .addLogger(new DevToolsLogger(connector))
  .build();`;

export const Logger: React.FC<Props> = ({
  logs,
  clearLogs,
  isConnected = true,
}) => {
  const [nonce, setNonce] = React.useState(0);
  const { options, setOptions, displayedLogs, uniqueTags } =
    useLogsDataAndOptions({
      logs,
    });

  const data = displayedLogs;

  const tableKey = useMemo(() => {
    const res = JSON.stringify(options) + nonce;
    return res;
  }, [options, nonce]);

  const onClickClearLogs = useCallback(() => {
    clearLogs();
    setNonce((prevNonce) => prevNonce + 1);
  }, [clearLogs]);

  const downloadLogs = useCallback(() => {
    const logsToExport = logs.map((log) => {
      const { payload, ...rest } = log;
      return rest;
    });
    const blob = new Blob([JSON.stringify(logsToExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-sdk-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  if (!isConnected) {
    return (
      <NotConnectedMessage
        title="Logger not connected"
        description={
          <>
            To enable logging, add <code>DevToolsLogger</code> to your DMK
            builder:
          </>
        }
        codeExample={LOGGER_CODE_EXAMPLE}
      />
    );
  }

  return (
    <Flex flex={1} flexDirection="column" minHeight={0} overflow="hidden">
      <Flex flexDirection="column" px={6} py={2} flexShrink={0}>
        <LoggerToolbar
          clearLogs={onClickClearLogs}
          downloadLogs={downloadLogs}
          options={options}
          setOptions={setOptions}
          uniqueTags={uniqueTags}
        />
      </Flex>
      <Divider mb={3} flexShrink={0} />
      <LogsTable data={data} key={tableKey} />
    </Flex>
  );
};
