import { type LogTag } from "@api/global/services/logger/model/LogSubscriberOptions";

/**
 * Interface for formatting log tags.
 * Allows different formatting strategies to be injected into subscribers.
 */
export interface LogTagFormatter {
  format(tag: LogTag): string;
}
