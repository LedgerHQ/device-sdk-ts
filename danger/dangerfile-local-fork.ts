import { danger, message, fail } from "danger";
import {
  checkBranches,
  checkCommits,
  checkChangesets,
  checkSignedCommits,
  getAuthor,
} from "./helpers";

const author = getAuthor(danger);
console.log("PR Actor:", author);

const results: boolean[] = [];

results.push(checkBranches(danger, fail, true));

results.push(checkCommits(danger, fail, true));

results.push(checkSignedCommits(danger, fail, true));

results.push(checkChangesets(danger, message));

const successful = results.every((result) => result === true);

if (successful) {
  message("Danger: All checks passed successfully! 🎉", { icon: "✅" });
}
