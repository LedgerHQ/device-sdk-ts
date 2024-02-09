import { Log, LoggerSubscriber } from "./Log";
/**
 * [IDEAS]
 * a data object in looger
 * context in logger (object || string ?) context.tag / context.type / context.id / context.os ...
 * message (string[]) in logger
 *
 * EXPOSE TO OUSTIDE => MOVE OUT OF INTERNAL
 */

export interface LoggerService {
  subscribers: LoggerSubscriber[];

  info(log: Log): void;
  warn(log: Log): void;
  debug(log: Log): void;
  error(log: Log): void;
}
