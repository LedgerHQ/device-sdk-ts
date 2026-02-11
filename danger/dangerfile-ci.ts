import { danger, markdown } from "danger";
import {
  runChecks,
  outputResults,
  getAuthor,
  checkIfBot,
  isFork,
} from "./helpers";
import { exit } from "process";

const author = getAuthor(danger);
console.log("PR Actor:", author);

const isBot = checkIfBot(danger.github.pr.user);

if (isBot) {
  console.log("PR Actor is a bot, skipping checks...");
  exit(0);
}

const fork = isFork(danger.github.pr);
const checkResults = runChecks(danger, { fork, includeTitle: true });
outputResults(checkResults, markdown);
