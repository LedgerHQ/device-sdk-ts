import { type LogTag } from "@api/logger-subscriber/model/LogSubscriberOptions";

/**
 * Interface for formatting log tags.
 * Allows different formatting strategies to be injected into subscribers.
 */
export interface LogTagFormatter {
  format(tag: LogTag): string;
}
