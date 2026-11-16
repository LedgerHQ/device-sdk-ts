import React from "react";

const formatCount = (count: number) => count.toLocaleString("en-US");

export const LogCounts: React.FC<{
  paused: boolean;
  total: number;
  displayed: number;
}> = ({ paused, total, displayed }) => (
  <span className="ml-auto shrink-0 pl-16 font-mono! body-4 whitespace-nowrap text-muted">
    {paused && <span className="text-warning">paused · </span>}
    {formatCount(total)} {total === 1 ? "event" : "events"}
    {total > displayed && ` · ${formatCount(total - displayed)} filtered out`}
  </span>
);
