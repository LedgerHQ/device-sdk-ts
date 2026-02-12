import { type LogData } from "./types";

/**
 * Represents a parsed filter token.
 * - keyword: case-insensitive text match
 * - regex: regular expression match
 */
export type FilterToken =
  | { type: "keyword"; value: string; exclude: boolean }
  | { type: "regex"; pattern: RegExp; exclude: boolean };

/**
 * Parses a Chrome DevTools-style filter query into tokens.
 *
 * Supported syntax:
 * - `keyword` - match logs containing "keyword" (case-insensitive)
 * - `word1 word2` - match logs containing both words (AND logic)
 * - `-keyword` - exclude logs containing "keyword"
 * - `/regex/` - match logs matching the regex pattern
 * - `-/regex/` - exclude logs matching the regex pattern
 *
 * @param query - The filter query string
 * @returns Array of parsed filter tokens
 */
export function parseFilterQuery(query: string): FilterToken[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const tokens: FilterToken[] = [];

  // Regex to match tokens: either a regex pattern (/.../) or a word
  // This handles: -/regex/, /regex/, -keyword, keyword
  const tokenRegex = /(-?)\/([^/]+)\/|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(trimmed)) !== null) {
    if (match[2] !== undefined) {
      // Regex pattern: match[1] is the optional "-", match[2] is the pattern
      const exclude = match[1] === "-";
      const patternStr = match[2];

      try {
        const pattern = new RegExp(patternStr, "i");
        tokens.push({ type: "regex", pattern, exclude });
      } catch {
        // Invalid regex - treat the whole thing as a keyword
        const rawToken = match[0];
        const isExclude = rawToken.startsWith("-");
        const value = isExclude ? rawToken.slice(1) : rawToken;
        if (value) {
          tokens.push({
            type: "keyword",
            value: value.toLowerCase(),
            exclude: isExclude,
          });
        }
      }
    } else if (match[3] !== undefined) {
      // Keyword: match[3] is the full token
      const token = match[3];
      const exclude = token.startsWith("-");
      const value = exclude ? token.slice(1) : token;

      if (value) {
        tokens.push({ type: "keyword", value: value.toLowerCase(), exclude });
      }
    }
  }

  return tokens;
}

/**
 * Converts a log's payload to a searchable string.
 */
function payloadToString(payload: LogData["payload"]): string {
  if (typeof payload === "string") {
    return payload;
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return "";
  }
}

/**
 * Creates a searchable text from a log entry.
 * Combines tag, message, and payload into a single string for matching.
 */
function logToSearchableText(log: LogData): string {
  const parts = [log.tag, log.message, payloadToString(log.payload)];
  return parts.join(" ");
}

/**
 * Tests if a single token matches the log text.
 */
function tokenMatches(token: FilterToken, text: string): boolean {
  if (token.type === "keyword") {
    return text.toLowerCase().includes(token.value);
  } else {
    return token.pattern.test(text);
  }
}

/**
 * Checks if a log entry matches the filter tokens.
 *
 * Matching logic:
 * - All include tokens must match (AND logic)
 * - No exclude tokens must match
 * - If no tokens, returns true (matches all)
 *
 * @param log - The log entry to test
 * @param tokens - The parsed filter tokens
 * @returns true if the log matches the filter
 */
export function matchesFilter(log: LogData, tokens: FilterToken[]): boolean {
  if (tokens.length === 0) {
    return true;
  }

  const searchText = logToSearchableText(log);

  const includeTokens = tokens.filter((t) => !t.exclude);
  const excludeTokens = tokens.filter((t) => t.exclude);

  // All include tokens must match
  for (const token of includeTokens) {
    if (!tokenMatches(token, searchText)) {
      return false;
    }
  }

  // No exclude tokens must match
  for (const token of excludeTokens) {
    if (tokenMatches(token, searchText)) {
      return false;
    }
  }

  return true;
}
