import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { promises as fs } from "fs";
import { LogLevel, type LogSubscriberOptions, type LoggerSubscriberService } from "@ledgerhq/device-management-kit";

const LDMK_CLI_DIR = dirname(__dirname);
const LOG_DIR = join(LDMK_CLI_DIR, "var", "logs");
const LOG_FILE = "logs.dev";

export class FileLogger implements LoggerSubscriberService {
  private readonly maxLevel: LogLevel;
  private readonly logFilePath: string;

  constructor(level: LogLevel = LogLevel.Debug) {
    this.maxLevel = level;
    this.logFilePath = join(LOG_DIR, LOG_FILE);
    this.ensureLogDirectoryAndFile();
  }

  private ensureLogDirectoryAndFile(): void {
    try {
      if (!existsSync(LOG_DIR)) {
        mkdirSync(LOG_DIR, { recursive: true });
      }
      if (!existsSync(this.logFilePath)) {
        writeFileSync(this.logFilePath, "");
      }
    } catch (error) {
      console.error(`Failed to create log directory or file: ${error}`);
    }
  }

  private getLevelTag(level: LogLevel | null): string {
    switch (level) {
      case LogLevel.Fatal:
        return "[FATAL]";
      case LogLevel.Error:
        return "[ERROR]";
      case LogLevel.Warning:
        return "[WARNING]";
      case LogLevel.Info:
        return "[INFO]";
      case LogLevel.Debug:
        return "[DEBUG]";
      default:
        return "[DEBUG]";
    }
  }

  private async writeToFile(
    levelTag: string,
    message: string,
    options: LogSubscriberOptions,
    timestamp: string,
  ): Promise<void> {
    try {
      let logLine = `${timestamp} ${levelTag} ${message}`;

      if (options.data) {
        logLine += ` ${JSON.stringify(options.data)}`;
      }

      logLine += "\n";

      await fs.appendFile(this.logFilePath, logLine);
    } catch (error) {
      console.error(`Failed to write to log file: ${error}`);
    }
  }

  public log(
    level: LogLevel | null,
    message: string,
    options: LogSubscriberOptions,
  ): void {
    const levelTag = this.getLevelTag(level);
    const timestamp = new Date().toISOString();

    switch (level) {
      case LogLevel.Info: {
        if (this.maxLevel >= LogLevel.Info) {
          this.writeToFile(levelTag, message, options, timestamp);
        }
        break;
      }
      case LogLevel.Warning: {
        if (this.maxLevel >= LogLevel.Warning) {
          this.writeToFile(levelTag, message, options, timestamp);
        }
        break;
      }
      case LogLevel.Debug: {
        if (this.maxLevel >= LogLevel.Debug) {
          this.writeToFile(levelTag, message, options, timestamp);
        }
        break;
      }
      case LogLevel.Error: {
        if (this.maxLevel >= LogLevel.Error) {
          this.writeToFile(levelTag, message, options, timestamp);
        }
        break;
      }
      case LogLevel.Fatal: {
        if (this.maxLevel >= LogLevel.Fatal) {
          this.writeToFile(levelTag, message, options, timestamp);
        }
        break;
      }
      default:
        this.writeToFile(levelTag, message, options, timestamp);
    }
  }
}