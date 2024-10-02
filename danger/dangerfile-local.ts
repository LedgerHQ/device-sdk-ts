import { danger, message, fail } from "danger";
import {
  checkBranches,
  checkCommits,
  checkChangesets,
  getAuthor,
} from "./helpers";

const author = getAuthor(danger);
console.log("PR Actor:", author);

let successful = true;

successful = checkBranches(danger, fail);

successful = checkCommits(danger, fail);

successful = checkChangesets(danger, message);

if (successful) {
  message("Danger: All checks passed successfully! 🎉", { icon: "✅" });
}
