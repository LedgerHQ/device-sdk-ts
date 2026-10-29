#!/usr/bin/env zx

// Measures how the team reacts to Copilot code review comments (DSDK-1399).
//
// Usage:
//   pnpm exec zx agent-files/scripts/copilot-review-metrics.cjs \
//     --since 2026-07-27 [--until 2026-10-27] [--opened-after 2026-10-28] \
//     [--samples 25] [--json out.json]
//
// --since/--until  filter on PR merge date (inclusive).
// --opened-after   only keep PRs created on or after this date (use it for the
//                  "after" measurement, so PRs reviewed with the old
//                  instructions are excluded).
// --samples N      print N random threads with their label, for calibration.
// --json FILE      write every classified thread to FILE.
//
// Each Copilot inline review thread is labelled:
//   rejected  a human reply disagrees ("intended", "false positive", ...)
//   acted     a human reply agrees ("done", "fixed", ...) or the commented
//             lines changed afterwards (thread is outdated)
//   ignored   none of the above
// "Ignored share" = (rejected + ignored) / total.
//
// Calibration (2026-10-27, 25 threads checked by hand): 24/25 correct. The
// error was an outdated thread whose lines changed for an unrelated reason, so
// the real ignored share is slightly higher than reported. The bias is the
// same on every run, so before/after comparisons stay valid.

require("zx/globals");

const REPO_OWNER = "LedgerHQ";
const REPO_NAME = "device-sdk-ts";
const COPILOT_LOGIN = /copilot/i;

const DISAGREE =
  /\b(not needed|no need|intended|intentional|on purpose|by design|false positive|won'?t fix|wontfix|not relevant|not applicable|not an issue|irrelevant|disagree|expected behaviou?r|out of scope|ignore)\b/i;
const AGREE =
  /\b(done|fixed|good catch|nice catch|addressed|updated|applied|changed|good point|resolved in)\b|\b[0-9a-f]{7,40}\b/i;

// Keyword buckets to spot recurring false-positive themes. A comment can
// match several themes; unmatched comments go to "other". Stems end with
// `\w*` so plurals and derived forms match ("tests", "duplicated").
const THEMES = {
  "naming / typo / wording":
    /\b(typo\w*|renam\w*|naming|spelling|grammar\w*|wording)\b/i,
  "docs / comments / jsdoc":
    /\b(jsdoc|docstring\w*|comment\w*|documentation|readme)\b/i,
  "error handling / throw":
    /\b(throw\w*|try\s*\/?\s*catch|error handling|unhandled|reject\w*)\b/i,
  "null / undefined checks":
    /\b(null\w*|undefined|optional chaining|non-null)\b/i,
  "types / any / casts":
    /\b(any|type assertions?|casts?|casting|as unknown|typing|type safety)\b/i,
  "tests / coverage": /\b(test\w*|coverage|assert\w*|mock\w*)\b/i,
  "duplication / refactor":
    /\b(duplicat\w*|refactor\w*|extract\w*|reus\w*|dry)\b/i,
  performance: /\b(performance|inefficien\w*|o\(n|memory|allocat\w*)\b/i,
  "magic numbers / constants": /\b(magic numbers?|hard-?coded|constants?)\b/i,
  "imports / exports": /\b(import\w*|export\w*|barrel\w*|circular)\b/i,
  "Buffer / Node APIs": /\b(Buffer|process\.|node:)/,
  "unused code / DI": /\b(unused|never used|dead code|inject\w*)\b/i,
  "changeset / version":
    /\b(changesets?|version bump\w*|semver|changelog\w*)\b/i,
  security: /\b(secur|leak|sensitive|private key|seed|sanitiz|validat)\w*/i,
};

function area(path) {
  if (!path) return "unknown";
  const m =
    path.match(/^packages\/(signer|transport|devtools|trusted-apps)\/[^/]+/) ||
    path.match(/^(packages|apps)\/[^/]+/);
  return m ? m[0] : path.split("/")[0];
}

function classify(thread) {
  const [first, ...rest] = thread.comments.nodes;
  const replies = rest.filter(
    (c) => !COPILOT_LOGIN.test(c.author?.login ?? ""),
  );
  const text = replies.map((c) => c.body).join("\n");
  if (DISAGREE.test(text)) return "rejected";
  if (AGREE.test(text) || thread.isOutdated) return "acted";
  return "ignored";
}

const QUERY = `
query($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: 25, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number url createdAt mergedAt
        reviews(first: 100) {
          pageInfo { hasNextPage }
          nodes { author { login } }
        }
        reviewThreads(first: 100) {
          pageInfo { hasNextPage }
          nodes {
            isResolved isOutdated path
            comments(first: 50) {
              pageInfo { hasNextPage }
              nodes { author { login } body url }
            }
          }
        }
      }
    }
  }
}`;

async function fetchPullRequests(searchQuery) {
  const prs = [];
  let cursor = null;
  do {
    const args = ["-f", `query=${QUERY}`, "-f", `q=${searchQuery}`];
    if (cursor) args.push("-f", `cursor=${cursor}`);
    const res = JSON.parse((await $`gh api graphql ${args}`.quiet()).stdout);
    const { nodes, pageInfo } = res.data.search;
    prs.push(...nodes.filter((n) => n.number));
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);
  assertComplete(prs);
  return prs;
}

// Nested connections are not paginated: fail rather than report metrics
// computed on truncated data.
function assertComplete(prs) {
  const truncated = prs.filter(
    (pr) =>
      pr.reviews.pageInfo.hasNextPage ||
      pr.reviewThreads.pageInfo.hasNextPage ||
      pr.reviewThreads.nodes.some((t) => t.comments.pageInfo.hasNextPage),
  );
  if (truncated.length > 0) {
    throw new Error(
      `Truncated reviews, threads or comments on PR(s) ${truncated
        .map((pr) => `#${pr.number}`)
        .join(", ")}: raise the limits in QUERY.`,
    );
  }
}

function pct(n, total) {
  return total ? `${((100 * n) / total).toFixed(1)}%` : "n/a";
}

function excerpt(body, len = 160) {
  return body
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/\s+/g, " ")
    .slice(0, len);
}

// Fisher–Yates shuffle: a random sort comparator doesn't give a uniform
// sample.
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// Escape backslashes first, then pipes, so the text stays in one table cell.
function escapeTableCell(text) {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

async function main() {
  const since = argv.since;
  const until = argv.until ?? new Date().toISOString().slice(0, 10);
  if (!since) {
    console.error(chalk.red("--since YYYY-MM-DD is required"));
    process.exit(1);
  }

  let q = `repo:${REPO_OWNER}/${REPO_NAME} is:pr is:merged merged:${since}..${until}`;
  if (argv["opened-after"]) q += ` created:>=${argv["opened-after"]}`;

  const prs = await fetchPullRequests(q);
  const reviewed = prs.filter((pr) =>
    pr.reviews.nodes.some((r) => COPILOT_LOGIN.test(r.author?.login ?? "")),
  );

  const threads = reviewed.flatMap((pr) =>
    pr.reviewThreads.nodes
      .filter((t) =>
        COPILOT_LOGIN.test(t.comments.nodes[0]?.author?.login ?? ""),
      )
      .map((t) => {
        const body = t.comments.nodes[0].body;
        const themes = Object.entries(THEMES)
          .filter(([, re]) => re.test(body))
          .map(([name]) => name);
        return {
          pr: pr.number,
          url: t.comments.nodes[0].url,
          path: t.path,
          area: area(t.path),
          isOutdated: t.isOutdated,
          isResolved: t.isResolved,
          replies: t.comments.nodes.length - 1,
          label: classify(t),
          themes: themes.length ? themes : ["other"],
          body,
        };
      }),
  );

  const count = (label) => threads.filter((t) => t.label === label).length;
  const total = threads.length;
  const notActed = count("rejected") + count("ignored");

  const tally = (key) => {
    const rows = {};
    for (const t of threads) {
      for (const k of [].concat(t[key])) {
        rows[k] ??= { total: 0, notActed: 0 };
        rows[k].total++;
        if (t.label !== "acted") rows[k].notActed++;
      }
    }
    return Object.entries(rows).sort((a, b) => b[1].notActed - a[1].notActed);
  };

  console.log(`## Copilot review metrics: ${REPO_OWNER}/${REPO_NAME}\n`);
  console.log(`- Query: \`${q}\``);
  console.log(
    `- Merged PRs: ${prs.length}, reviewed by Copilot: ${reviewed.length}`,
  );
  console.log(
    `- Copilot inline comments: ${total} (${(total / (reviewed.length || 1)).toFixed(2)} per reviewed PR)`,
  );
  console.log(`- Acted on: ${count("acted")} (${pct(count("acted"), total)})`);
  console.log(
    `- Rejected (reply disagrees): ${count("rejected")} (${pct(count("rejected"), total)})`,
  );
  console.log(
    `- Ignored (no reply, code unchanged): ${count("ignored")} (${pct(count("ignored"), total)})`,
  );
  console.log(
    `- **Ignored share (rejected + ignored): ${pct(notActed, total)}**\n`,
  );

  for (const [title, key] of [
    ["Themes", "themes"],
    ["Areas", "area"],
  ]) {
    console.log(`### ${title} (sorted by not-acted count)\n`);
    console.log(
      "| | Comments | Not acted | Not-acted share |\n|---|---|---|---|",
    );
    for (const [name, r] of tally(key).slice(0, 15)) {
      console.log(
        `| ${name} | ${r.total} | ${r.notActed} | ${pct(r.notActed, r.total)} |`,
      );
    }
    console.log("");
  }

  if (argv.samples) {
    const sample = shuffle([...threads]).slice(0, argv.samples);
    console.log(`### Calibration sample (${sample.length} threads)\n`);
    console.log("| # | Label | Thread | Comment |\n|---|---|---|---|");
    sample.forEach((t, i) =>
      console.log(
        `| ${i + 1} | ${t.label} | [#${t.pr}](${t.url}) | ${escapeTableCell(excerpt(t.body, 120))} |`,
      ),
    );
    console.log("");
  }

  if (argv.json) {
    await fs.writeJson(argv.json, threads, { spaces: 2 });
    console.log(chalk.gray(`Wrote ${threads.length} threads to ${argv.json}`));
  }
}

main().catch((err) => {
  console.error(chalk.red(err.stderr || err.message));
  process.exit(1);
});
