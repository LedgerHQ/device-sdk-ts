import { type LogTag } from "@api/logger-subscriber/model/LogSubscriberOptions";

import { type LogTagFormatter } from "./LogTagFormatter";

/**
 * Default implementation of LogTagFormatter.
 * Formats tags as "[tag1] [tag2] [tag3]" for arrays, or "[tag]" for strings.
 */
export class DefaultLogTagFormatter implements LogTagFormatter {
  format(tag: LogTag): string {
    if (Array.isArray(tag)) {
      return tag.map((t) => `[${t}]`).join(" ");
    }
    return `[${tag}]`;
  }
}
