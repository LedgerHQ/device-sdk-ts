import { Log, LoggerSubscriber } from "./Log";

export interface LoggerService {
  subscribers: LoggerSubscriber[];

  error(log: Log): void;
  warn(log: Log): void;
  info(log: Log): void;
  debug(log: Log): void;
}
