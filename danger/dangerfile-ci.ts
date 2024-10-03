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

let successful = true;
let fork = isFork(danger.github.pr);

successful = checkBranches(danger, fail, fork);

successful = checkCommits(danger, fail, fork);

successful = checkTitle(danger, fail, fork);

successful = checkChangesets(danger, message);

if (successful) {
  message("Danger: All checks passed successfully! 🎉", { icon: "✅" });
}
