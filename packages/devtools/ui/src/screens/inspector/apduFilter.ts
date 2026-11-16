import { type FilterToken } from "../logger/filterUtils";

function tokenMatches(token: FilterToken, text: string): boolean {
  if (token.type === "keyword") {
    return text.toLowerCase().includes(token.value);
  } else {
    return token.pattern.test(text);
  }
}

export function matchesText(
  searchText: string,
  tokens: FilterToken[],
): boolean {
  if (tokens.length === 0) {
    return true;
  }

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
