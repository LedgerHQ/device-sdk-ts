import { danger, fail, message } from "danger";
import {
  checkBranches,
  checkCommits,
  checkChangesets,
  checkSignedCommits,
  checkTitle,
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

const results: boolean[] = [];

let fork = isFork(danger.github.pr);

results.push(checkBranches(danger, fail, fork));

results.push(checkCommits(danger, fail, fork));

results.push(checkTitle(danger, fail, fork));

results.push(checkSignedCommits(danger, fail, fork));

results.push(checkChangesets(danger, message));

const successful = results.every((result) => result === true);

if (successful) {
  message("Danger: All checks passed successfully! 🎉", { icon: "✅" });
}
