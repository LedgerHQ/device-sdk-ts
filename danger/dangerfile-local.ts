import { danger, markdown, fail } from "danger";
import { runChecks, outputResults, getAuthor } from "./helpers";

console.log("PR Actor:", getAuthor(danger));

const checkResults = runChecks(danger, { fork: false, includeTitle: false });
outputResults(checkResults, markdown, fail);
