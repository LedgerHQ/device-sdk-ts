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

(async () => {
  try {
    const author = getAuthor(danger);
    console.log("PR Actor:", author);

    const isBot = checkIfBot(danger.github.pr.user);

    if (isBot) {
      console.log("PR Actor is a bot, skipping checks...");
      return;
    }

    const results: boolean[] = [];
    const fork = isFork(danger.github.pr);

    results.push(checkBranches(danger, fail, fork));
    results.push(checkCommits(danger, fail, fork));
    results.push(checkTitle(danger, fail, fork));
    results.push(checkChangesets(danger, message));

    const successful = results.every((result) => result === true);

    if (successful) {
      message("Danger: All checks passed successfully! 🎉", { icon: "✅" });
    }
  } catch (error) {
    console.error("Danger encountered an error:", error);
    fail("Danger encountered an unexpected error. Please check the logs.");
    process.exit(1);
  }
})();
