import {
  type LoggerSubscriberService,
  LogLevel,
} from "@ledgerhq/device-management-kit";
import * as fs from "fs/promises";

type LogSubscriberOptions = {
  timestamp: number;
  tag: string;
  data?: Record<string, unknown>;
};

export class FileLogger implements LoggerSubscriberService {
  private readonly maxLevel: LogLevel;
  private readonly filePath: string;

  constructor(filePath: string, level: LogLevel = LogLevel.Debug) {
    this.maxLevel = level;
    this.filePath = filePath;
  }

  log(
    level: LogLevel | null,
    message: string,
    options: LogSubscriberOptions,
  ): void {
    const tag = `[${options.tag}]`;
    const timestamp = new Date(options.timestamp).toISOString();
    const levelName = this.getLevelName(level);

    switch (level) {
      case LogLevel.Info: {
        if (this.maxLevel >= LogLevel.Info) {
          void this.writeLog(timestamp, levelName, tag, message, options);
        }
        break;
      }
      case LogLevel.Warning: {
        if (this.maxLevel >= LogLevel.Warning) {
          void this.writeLog(timestamp, levelName, tag, message, options);
        }
        break;
      }
      case LogLevel.Debug: {
        if (this.maxLevel >= LogLevel.Debug) {
          void this.writeLog(timestamp, levelName, tag, message, options);
        }
        break;
      }
      case LogLevel.Error: {
        if (this.maxLevel >= LogLevel.Error) {
          void this.writeLog(timestamp, levelName, tag, message, options);
        }
        break;
      }
      case LogLevel.Fatal: {
        if (this.maxLevel >= LogLevel.Fatal) {
          void this.writeLog(timestamp, levelName, tag, message, options);
        }
        break;
      }
      default:
        void this.writeLog(timestamp, "LOG", tag, message, options);
    }
  }

  private getLevelName(level: LogLevel | null): string {
    switch (level) {
      case LogLevel.Fatal:
        return "FATAL";
      case LogLevel.Error:
        return "ERROR";
      case LogLevel.Warning:
        return "WARN";
      case LogLevel.Info:
        return "INFO";
      case LogLevel.Debug:
        return "DEBUG";
      default:
        return "LOG";
    }
  }

  private async writeLog(
    timestamp: string,
    level: string,
    tag: string,
    message: string,
    options: LogSubscriberOptions,
  ): Promise<void> {
    let logLine = `${timestamp} [${level}] ${tag} ${message}`;
    if (options.data) {
      logLine += ` ${JSON.stringify(options.data)}`;
    }
    await fs.appendFile(this.filePath, logLine + "\n");
  }
}
