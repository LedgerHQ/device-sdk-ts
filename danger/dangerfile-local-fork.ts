import { danger, markdown } from "danger";
import { runChecks, outputResults, getAuthor } from "./helpers";

console.log("PR Actor:", getAuthor(danger));

const checkResults = runChecks(danger, { fork: true, includeTitle: false });
outputResults(checkResults, markdown);
