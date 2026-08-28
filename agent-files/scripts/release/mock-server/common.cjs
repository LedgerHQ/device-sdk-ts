#!/usr/bin/env zx

require("zx/globals");
const semver = require("semver");
const { ROOT, readChangesets } = require("../config.cjs");

const PKG_NAME = "@ledgerhq/device-mock-server";
const DISPLAY_NAME = "Mock Server";
const PKG_DIR = path.join(ROOT, "apps", "device-mock-server");
const PKG_PATH = path.join(PKG_DIR, "package.json");
const CHANGELOG_PATH = path.join(PKG_DIR, "CHANGELOG.md");
const CHANGESET_DIR = path.join(ROOT, ".changeset");
const IMAGE_REPO = "jfrog.ledgerlabs.net/bcs-oci-prod-green/device-mock-server";

const BUMP_ORDER = { patch: 0, minor: 1, major: 2 };

function readPackage() {
  return fs.readJson(PKG_PATH);
}

/** Changesets that declare a bump for the mock server. */
async function pendingChangesets() {
  const all = await readChangesets();
  return all
    .filter((cs) => PKG_NAME in cs.packages)
    .map((cs) => ({
      file: cs.file,
      bump: cs.packages[PKG_NAME],
      summary: cs.summary,
      otherPackages: Object.keys(cs.packages).filter((p) => p !== PKG_NAME),
    }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

function highestBump(changesets) {
  let best = null;
  for (const cs of changesets) {
    if (best === null || BUMP_ORDER[cs.bump] > BUMP_ORDER[best]) best = cs.bump;
  }
  return best;
}

/**
 * `--bump <type>` wins over the changesets, so a release can still be cut for
 * changes that never warranted a changeset (Dockerfile, CI, deps).
 */
function resolveBump(changesets, override) {
  if (override) {
    if (!(override in BUMP_ORDER)) {
      throw new Error(
        `Invalid --bump "${override}". Use one of: patch, minor, major.`,
      );
    }
    return { bump: override, source: "override" };
  }

  const bump = highestBump(changesets);
  if (!bump) {
    throw new Error(
      `No pending changeset for ${PKG_NAME}. Add one (see the changeset skill) ` +
        `or pass --bump patch|minor|major to release without one.`,
    );
  }
  return { bump, source: "changesets" };
}

function nextVersion(from, bump) {
  const to = semver.inc(from, bump);
  if (!to) throw new Error(`Failed to compute ${bump} bump for ${from}`);
  return to;
}

async function readRepoSlug() {
  try {
    const cfg = await fs.readJson(path.join(CHANGESET_DIR, "config.json"));
    if (Array.isArray(cfg.changelog) && cfg.changelog[1]?.repo) {
      return cfg.changelog[1].repo;
    }
  } catch {}
  return "LedgerHQ/device-sdk-ts";
}

/**
 * Attach the commit that introduced each changeset plus its PR number and
 * author, so entries match the format the DMK release produces. Only the mock
 * server changesets are looked up, to keep the GitHub API calls to a minimum.
 */
async function enrich(changesets) {
  const repo = await readRepoSlug();
  const prevVerbose = $.verbose;
  $.verbose = false;

  try {
    for (const cs of changesets) {
      const filePath = path.join(CHANGESET_DIR, cs.file);
      const res =
        await $`git log --diff-filter=A --format=%H -1 -- ${filePath}`;
      cs.commit = res.stdout.trim() || null;
      if (!cs.commit) {
        throw new Error(
          `No commit found for .changeset/${cs.file}. Was it committed to git?`,
        );
      }
    }

    const metaBySha = new Map();
    for (const sha of new Set(changesets.map((cs) => cs.commit))) {
      const endpoint = `repos/${repo}/commits/${sha}/pulls`;
      const jq = ".[0] | {number, user: .user.login}";
      let res;
      try {
        res = await $`gh api ${endpoint} --jq ${jq}`;
      } catch (err) {
        throw new Error(
          `Failed to fetch PR metadata for commit ${sha}. Is gh authenticated?\n${err.message}`,
        );
      }
      const data = JSON.parse(res.stdout.trim());
      if (!data.number || !data.user) {
        throw new Error(
          `Incomplete PR metadata for commit ${sha}: prNumber=${data.number}, author=${data.user}`,
        );
      }
      metaBySha.set(sha, { prNumber: data.number, author: data.user });
    }

    for (const cs of changesets) {
      const meta = metaBySha.get(cs.commit);
      cs.prNumber = meta.prNumber;
      cs.author = meta.author;
    }
  } finally {
    $.verbose = prevVerbose;
  }

  return { changesets, repo };
}

function fail(err) {
  console.error(chalk.red(err.message || String(err)));
  process.exit(1);
}

module.exports = {
  BUMP_ORDER,
  CHANGELOG_PATH,
  CHANGESET_DIR,
  DISPLAY_NAME,
  IMAGE_REPO,
  PKG_DIR,
  PKG_NAME,
  PKG_PATH,
  enrich,
  fail,
  highestBump,
  nextVersion,
  pendingChangesets,
  readPackage,
  readRepoSlug,
  resolveBump,
};
