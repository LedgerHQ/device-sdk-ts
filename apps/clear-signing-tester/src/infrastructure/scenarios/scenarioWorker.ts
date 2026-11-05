// Each worker has its own fetch, so it needs its own patched one.
import "@root/src/setup/installUndici";

import { parentPort, workerData } from "worker_threads";

import { ContainerScenarioRunner } from "@root/src/infrastructure/scenarios/ContainerScenarioRunner";
import {
  type ScenarioWorkerData,
  type ScenarioWorkerMessage,
} from "@root/src/infrastructure/scenarios/WorkerScenarioRunner";

const { run, runtime } = workerData as ScenarioWorkerData;
const runner = new ContainerScenarioRunner(runtime);
const post = (message: ScenarioWorkerMessage) =>
  parentPort!.postMessage(message);

parentPort!.on("message", (message: unknown) => {
  if (message !== "release") return;
  void runner.releaseAll().then((count) => {
    post({ type: "released", count });
    process.exit(0);
  });
});

void runner.run(run).then((outcome) => {
  post({ type: "outcome", outcome });
  parentPort!.close();
});
