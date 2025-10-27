import { Divider, Flex } from "@ledgerhq/react-ui";
import React, { useCallback, useMemo } from "react";
import { LoggerToolbar } from "./LoggerToolbar";
import { ScrollableLogTable } from "./ScrollableLogTable";
import { LogData } from "./types";
import { useLogsDataAndOptions } from "./useLogsDataAndOptions";

type Props = {
  logs: Array<LogData>;
  clearLogs: () => void;
};

export const Logger: React.FC<Props> = ({ logs, clearLogs }) => {
  const [nonce, setNonce] = React.useState(0);
  const { options, setOptions, displayedLogs, uniqueTags } =
    useLogsDataAndOptions({
      logs,
    });

  const data = displayedLogs;

  const tableKey = useMemo(() => {
    const res = JSON.stringify(options) + nonce;
    console.log("optionsKey", res);
    return res;
  }, [options, nonce]);

  const onClickClearLogs = useCallback(() => {
    clearLogs();
    setNonce((nonce) => nonce + 1);
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

  return (
    <Flex flex={1} flexDirection="column" p={6} pt={0}>
      <Flex flexDirection="column" py={"5px"}>
        <LoggerToolbar
          clearLogs={onClickClearLogs}
          downloadLogs={downloadLogs}
          options={options}
          setOptions={setOptions}
          uniqueTags={uniqueTags}
        />
      </Flex>
      <Divider mb={3} />
      <span>logs: {data.length}</span>
      <ScrollableLogTable data={data} key={tableKey} />
    </Flex>
  );
};
