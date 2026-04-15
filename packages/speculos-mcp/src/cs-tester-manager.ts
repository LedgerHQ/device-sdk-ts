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
  vncUrl?: string;
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

export class CsTesterManager {
  private childProcess: ChildProcess | null = null;
  private currentDevice: string | null = null;
  private currentApiUrl: string | null = null;
  private currentVncUrl: string | null = null;
  private processOutput: string[] = [];

  async start(
    baseURL: string,
    options: StartSpeculosOptions = {},
  ): Promise<{ apiUrl: string; device: string; vncUrl: string }> {
    if (this.childProcess) {
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

    this.processOutput = [];
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
        if (this.processOutput.length >= MAX_OUTPUT_LINES) {
          this.processOutput.shift();
        }
        this.processOutput.push(line);
        log("debug", "docker", `[cs-tester stdout] ${line}`);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) {
        if (this.processOutput.length >= MAX_OUTPUT_LINES) {
          this.processOutput.shift();
        }
        this.processOutput.push(line);
        log("debug", "docker", `[cs-tester stderr] ${line}`);
      }
    });

    child.once("error", (err) => {
      log("error", "docker", `cs-tester process error: ${err.message}`);
      this.childProcess = null;
      this.currentDevice = null;
      this.currentApiUrl = null;
      this.currentVncUrl = null;
    });

    child.once("exit", (code) => {
      log("info", "docker", `cs-tester process exited with code ${code}`);
      this.childProcess = null;
      this.currentDevice = null;
      this.currentApiUrl = null;
      this.currentVncUrl = null;
    });

    this.childProcess = child;
    this.currentDevice = device;
    this.currentApiUrl = apiUrl;
    this.currentVncUrl = `vnc://localhost:${vncPort}`;

    try {
      await this.waitForSpeculosOrExit(apiUrl, STARTUP_TIMEOUT_MS);
    } catch (err) {
      await this.cleanup();
      const recentOutput = this.processOutput.slice(-20).join("\n");
      throw new Error(
        `Failed to start Speculos: ${err instanceof Error ? err.message : String(err)}\n` +
          `Recent cs-tester output:\n${recentOutput}`,
      );
    }

    log(
      "info",
      "docker",
      `Speculos is running at ${apiUrl} (device: ${device}, vnc: ${this.currentVncUrl})`,
    );
    return { apiUrl, device, vncUrl: this.currentVncUrl! };
  }

  private async waitForSpeculosOrExit(
    apiUrl: string,
    timeoutMs: number,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (!this.childProcess || this.childProcess.exitCode !== null) {
        throw new Error(
          "cs-tester process exited before Speculos became reachable",
        );
      }
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

  private async cleanup(): Promise<void> {
    if (!this.childProcess) {
      this.currentDevice = null;
      this.currentApiUrl = null;
      this.currentVncUrl = null;
      return;
    }
    try {
      await this.stop();
    } catch {
      this.childProcess = null;
      this.currentDevice = null;
      this.currentApiUrl = null;
      this.currentVncUrl = null;
    }
  }

  async stop(): Promise<void> {
    if (!this.childProcess) {
      throw new Error(
        "No Speculos instance is currently managed by this server.",
      );
    }

    const pid = this.childProcess.pid;
    log("info", "docker", `Stopping Speculos (pid: ${pid})...`);

    return new Promise((res, rej) => {
      const child = this.childProcess!;
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
        this.childProcess = null;
        this.currentDevice = null;
        this.currentApiUrl = null;
        this.currentVncUrl = null;
        log("info", "docker", "Speculos stopped.");
        res();
      });

      child.once("error", (err) => {
        clearTimeout(timeout);
        this.childProcess = null;
        this.currentDevice = null;
        this.currentApiUrl = null;
        this.currentVncUrl = null;
        rej(new Error(`Failed to stop cs-tester: ${err.message}`));
      });

      child.kill("SIGTERM");
    });
  }

  getStatus(): SpeculosStatus {
    if (!this.childProcess || this.childProcess.exitCode !== null) {
      return { running: false };
    }
    return {
      running: true,
      device: this.currentDevice ?? undefined,
      apiUrl: this.currentApiUrl ?? undefined,
      vncUrl: this.currentVncUrl ?? undefined,
    };
  }
}
