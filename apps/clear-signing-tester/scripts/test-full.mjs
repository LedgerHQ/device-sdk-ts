#!/usr/bin/env zx

import "zx/globals";
import concurrently from "concurrently";

function success() {
  console.log("✅ All tests completed successfully!");
  process.exit(0);
}

function failure() {
  console.error("❌ One or more tests failed:");
  process.exit(1);
}

const args = process.argv.slice(3);

// Define all test commands that should be run
const testCommands = [
  {
    name: "raw-erc20",
    command: `pnpm cli raw-file ./ressources/raw-erc20.json ${args.join(" ")}`,
  },
  {
    name: "raw-complete",
    command: `pnpm cli raw-file ./ressources/raw-complete.json ${args.join(" ")}`,
  },
  {
    name: "raw-multisig",
    command: `pnpm cli raw-file ./ressources/raw-multisig.json ${args.join(" ")}`,
  },
  {
    name: "typed-data-multisig",
    command: `pnpm cli typed-data-file ./ressources/typed-data-multisig.json ${args.join(" ")}`,
  },
];

try {
  // Run all test commands concurrently
  const { result } = concurrently(testCommands, {
    prefix: "name",
    prefixColors: ["green", "blue", "red", "yellow"],
    restartTries: 0,
    cwd: process.cwd(),
  });

  result.then(success, failure);
} catch (error) {
  failure(error);
}
