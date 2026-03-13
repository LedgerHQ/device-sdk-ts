import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import axios from "axios";

import { log } from "./logger";

export type StartSpeculosOptions = {
  device?: "stax" | "nanox" | "nanos" | "nanos+" | "flex" | "apex";
  appEthVersion?: string;
  osVersion?: string;
  dockerImageTag?: string;
  customAppPath?: string;
  vncPort?: number;
};

type SpeculosStatus = {
  running: boolean;
  device?: string;
  apiUrl?: string;
};

const POLL_INTERVAL_MS = 2000;
const STARTUP_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_LINES = 500;

function findWorkspaceRoot(): string {
  const packageDir = resolve(fileURLToPath(import.meta.url), "..", "..");
  let dir = packageDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not find workspace root (pnpm-workspace.yaml) starting from ${packageDir}`,
  );
}

let childProcess: ChildProcess | null = null;
let currentDevice: string | null = null;
let currentApiUrl: string | null = null;
let processOutput: string[] = [];

async function waitForSpeculos(
  apiUrl: string,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await axios.get(`${apiUrl}/events`, {
        params: { currentscreenonly: true },
        timeout: 3000,
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
  throw new Error(
    `Speculos did not become reachable at ${apiUrl} within ${timeoutMs / 1000}s`,
  );
}

export async function startSpeculos(
  baseURL: string,
  options: StartSpeculosOptions = {},
): Promise<{ apiUrl: string; device: string }> {
  if (childProcess) {
    throw new Error(
      "A Speculos instance is already managed by this server. Call stop_speculos first.",
    );
  }

  if (!process.env["COIN_APPS_PATH"]) {
    throw new Error(
      "COIN_APPS_PATH environment variable is not set. " +
        "It must point to the directory containing Ledger app binaries.",
    );
  }

  const url = new URL(baseURL);
  const port = url.port || "5000";
  const host = url.hostname;
  const device = options.device ?? "stax";
  const apiUrl = `http://${host}:${port}`;

  const workspaceRoot = findWorkspaceRoot();

  const vncPort = options.vncPort ?? 3337;

  const args = [
    "cs-tester",
    "cli",
    "start-speculos",
    "--speculos-url",
    `http://${host}`,
    "--speculos-port",
    port,
    "--speculos-vnc-port",
    vncPort.toString(),
    "--device",
    device,
  ];

  if (options.dockerImageTag) {
    args.push("--docker-image-tag", options.dockerImageTag);
  }
  if (options.appEthVersion) {
    args.push("--app-eth-version", options.appEthVersion);
  }
  if (options.osVersion) {
    args.push("--os-version", options.osVersion);
  }
  if (options.customAppPath) {
    args.push("--custom-app", options.customAppPath);
  }

  processOutput = [];
  log(
    "info",
    "docker",
    `Starting Speculos via cs-tester: pnpm ${args.join(" ")}`,
  );

  const child = spawn("pnpm", args, {
    cwd: workspaceRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  child.stdout?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) {
      if (processOutput.length >= MAX_OUTPUT_LINES) {
        processOutput.shift();
      }
      processOutput.push(line);
      log("debug", "docker", `[cs-tester stdout] ${line}`);
    }
  });

  child.stderr?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) {
      if (processOutput.length >= MAX_OUTPUT_LINES) {
        processOutput.shift();
      }
      processOutput.push(line);
      log("debug", "docker", `[cs-tester stderr] ${line}`);
    }
  });

  child.once("error", (err) => {
    log("error", "docker", `cs-tester process error: ${err.message}`);
    childProcess = null;
    currentDevice = null;
    currentApiUrl = null;
  });

  child.once("exit", (code) => {
    log("info", "docker", `cs-tester process exited with code ${code}`);
    childProcess = null;
    currentDevice = null;
    currentApiUrl = null;
  });

  childProcess = child;
  currentDevice = device;
  currentApiUrl = apiUrl;

  try {
    await waitForSpeculos(apiUrl, STARTUP_TIMEOUT_MS);
  } catch (err) {
    await stopSpeculos();
    const recentOutput = processOutput.slice(-20).join("\n");
    throw new Error(
      `Failed to start Speculos: ${err instanceof Error ? err.message : String(err)}\n` +
        `Recent cs-tester output:\n${recentOutput}`,
    );
  }

  log("info", "docker", `Speculos is running at ${apiUrl} (device: ${device})`);
  return { apiUrl, device };
}

export async function stopSpeculos(): Promise<void> {
  if (!childProcess) {
    throw new Error(
      "No Speculos instance is currently managed by this server.",
    );
  }

  const pid = childProcess.pid;
  log("info", "docker", `Stopping Speculos (pid: ${pid})...`);

  return new Promise((res, rej) => {
    const child = childProcess!;
    child.removeAllListeners("exit");
    child.removeAllListeners("error");

    const timeout = setTimeout(() => {
      log(
        "warning",
        "docker",
        "cs-tester did not exit gracefully, sending SIGKILL",
      );
      child.kill("SIGKILL");
    }, 10_000);

    child.once("exit", () => {
      clearTimeout(timeout);
      childProcess = null;
      currentDevice = null;
      currentApiUrl = null;
      log("info", "docker", "Speculos stopped.");
      res();
    });

    child.once("error", (err) => {
      clearTimeout(timeout);
      childProcess = null;
      currentDevice = null;
      currentApiUrl = null;
      rej(new Error(`Failed to stop cs-tester: ${err.message}`));
    });

    child.kill("SIGTERM");
  });
}

export function getStatus(): SpeculosStatus {
  if (!childProcess || childProcess.exitCode !== null) {
    return { running: false };
  }
  return {
    running: true,
    device: currentDevice ?? undefined,
    apiUrl: currentApiUrl ?? undefined,
  };
}
