"use client";
import { memo } from "react";
import makeOpenAppMachine, { Context } from "./openAppStateMachine";
import { createActor } from "xstate";
import { createBrowserInspector } from "@statelyai/inspect";

const inspector = createBrowserInspector();

const openAppMachine = makeOpenAppMachine();

function Machine() {
  const startMachine = () => {
    console.log("Creating machine actor");
    const openAppMachineActor = createActor(openAppMachine, {
      inspect: inspector.inspect,
      input: {
        requestedAppName: "Bitcoin",
        deviceSessionState: {
          status: "Ready",
          deviceOnboarded: true,
        },
      },
    });

    let previousUserActionNeeded: Context["userActionNeeded"] = null;
    let previousStateValue: string | null = null;

    openAppMachineActor.start();
    openAppMachineActor.subscribe((state) => {
      if (state.value !== previousStateValue) {
        console.log("machine: new state", state.value);
        previousStateValue = state.value;
      }
      if (state.context.userActionNeeded !== previousUserActionNeeded) {
        console.log(
          "machine: user action needed",
          state.context.userActionNeeded
        );
        previousUserActionNeeded = state.context.userActionNeeded;
      }
      if (state.status === "done") {
        console.log("machine: done", state);
        console.log("machine output:", state.output);
      }
    });
  };
  return <button onClick={startMachine}>Start machine</button>;
}

export default memo(Machine);
