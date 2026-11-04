import React, { useCallback, useRef, useState } from "react";
import {
  GetOsVersionCommand,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Button } from "@ledgerhq/lumen-ui-react";
import { ArrowRight, CloudUpload } from "@ledgerhq/lumen-ui-react/symbols";

import { Block } from "@/components/Block";
import { type LogEntry, LogPanel } from "@/components/LogPanel";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { type ApduSender, sideloadApp } from "@/utils/sideloadApp";

import { DropZone, HiddenInput, ProgressFill, ProgressTrack } from "./styles";

type SideloadProgress = {
  phase: string;
  pct: number;
};

export const SideloadAppView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<SideloadProgress | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFile = useCallback((file: File | null) => {
    setFileError(null);
    setProgress(null);
    setLogs([]);
    if (file && !file.name.toLowerCase().endsWith(".apdu")) {
      setFileError("Please select a .apdu file");
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!loading) setIsDragging(true);
    },
    [loading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (loading) return;
      selectFile(e.dataTransfer.files[0] ?? null);
    },
    [loading, selectFile],
  );

  const handleClick = useCallback(() => {
    if (!loading) fileInputRef.current?.click();
  }, [loading]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      selectFile(e.target.files?.[0] ?? null);
    },
    [selectFile],
  );

  const handleSideload = useCallback(async () => {
    if (!selectedFile) return;

    setFileError(null);
    setLoading(true);
    setProgress(null);
    setLogs([]);

    try {
      const scriptContent = await selectedFile.text();

      const osResult = await dmk.sendCommand({
        sessionId,
        command: new GetOsVersionCommand(),
      });
      if (!isSuccessCommandResult(osResult)) {
        throw new Error(
          `Failed to read device OS version: ${JSON.stringify(osResult.error)}`,
        );
      }

      const sendApdu: ApduSender = async (apdu) => {
        const resp = await dmk.sendApdu({ sessionId, apdu });
        const result = new Uint8Array(resp.data.length + 2);
        result.set(resp.data);
        result[resp.data.length] = resp.statusCode[0]!;
        result[resp.data.length + 1] = resp.statusCode[1]!;
        return result;
      };

      await sideloadApp(
        sendApdu,
        scriptContent,
        osResult.data.targetId,
        (phase, pct) => {
          setProgress({ phase, pct });
          setLogs((prev) => [
            ...prev,
            {
              date: new Date(),
              message: `${phase} (${Math.round(pct)}%)`,
              type: "info",
            },
          ]);
        },
      );

      setLogs((prev) => [
        ...prev,
        {
          date: new Date(),
          message: "App sideloaded successfully.",
          type: "success",
        },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setLogs((prev) => [
        ...prev,
        { date: new Date(), message, type: "error" },
      ]);
    } finally {
      setLoading(false);
    }
  }, [selectedFile, dmk, sessionId]);

  return (
    <div className="flex flex-col gap-y-12 p-16" style={{ maxWidth: 600 }}>
      <span className="heading-4-semi-bold">Sideload App</span>
      <span className="body-2 text-muted">
        Select a .apdu install script and replay it onto the connected device
        over the secure channel.
      </span>
      <Block>
        <DropZone
          isDragging={isDragging}
          disabled={loading}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          data-testid="dropzone_sideload-app"
        >
          <HiddenInput
            ref={fileInputRef}
            type="file"
            accept=".apdu"
            onChange={handleFileChange}
            disabled={loading}
          />
          <div className="flex flex-col items-center gap-y-8">
            <CloudUpload size={24} />
            <span className="body-2">
              {selectedFile
                ? selectedFile.name
                : "Drop a .apdu file here or click to select"}
            </span>
          </div>
        </DropZone>

        <Button
          appearance="base"
          disabled={!selectedFile || loading}
          onClick={handleSideload}
          icon={ArrowRight}
          loading={loading}
          data-testid="CTA_sideload-application"
        >
          Sideload Application
        </Button>

        {fileError && (
          <span
            className="body-2 text-error"
            data-testid="text_sideload-file-error"
          >
            {fileError}
          </span>
        )}

        {progress && (
          <div className="flex flex-col gap-y-4">
            <ProgressTrack>
              <ProgressFill pct={progress.pct} />
            </ProgressTrack>
            <span className="body-3 text-muted">
              {progress.phase} ({Math.round(progress.pct)}%)
            </span>
          </div>
        )}

        <LogPanel logs={logs} />
      </Block>
    </div>
  );
};
