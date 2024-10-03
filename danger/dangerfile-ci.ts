import { danger, fail, message } from "danger";
import {
  checkBranches,
  checkCommits,
  checkChangesets,
  checkTitle,
  getAuthor,
  checkIfBot,
  isFork,
} from "./helpers";

const author = getAuthor(danger);
console.log("PR Actor:", author);

checkIfBot(danger.github.pr.user);

const results: boolean[] = [];

let fork = isFork(danger.github.pr);

results.push(checkBranches(danger, fail, fork));

results.push(checkCommits(danger, fail, fork));

results.push(checkTitle(danger, fail, fork));

results.push(checkChangesets(danger, message));

const successful = results.every((result) => result === true);

if (successful) {
  message("Danger: All checks passed successfully! 🎉", { icon: "✅" });
}
