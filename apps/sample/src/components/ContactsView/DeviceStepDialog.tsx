import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  DeviceActionStatus,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import {
  Button,
  DialogBody,
  DialogHeader,
  Spinner,
  Spot,
} from "@ledgerhq/lumen-ui-react";
import { Devices, LedgerDevices } from "@ledgerhq/lumen-ui-react/symbols";

import { type ContactsDeviceOperation } from "@/components/ContactsView/deviceOperations";
import { ContactsDialog } from "@/components/ContactsView/dialogs/ContactsDialog";
import { useConnectDevice } from "@/hooks/useConnectDevice";
import {
  type ContactsErrorScreen,
  describeContactsError,
  mapContactsError,
} from "@/lib/contacts/contactsErrors";
import { useContactsManagers } from "@/providers/ContactsProvider";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type RunState =
  | { type: "running"; stepIndex: number; interaction: string }
  | {
      type: "error";
      stepIndex: number;
      screen: ContactsErrorScreen;
      details: string;
    };

const initialRunState: RunState = {
  type: "running",
  stepIndex: 0,
  interaction: UserInteractionRequired.None,
};

function useConnectedDeviceName(): string {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);
  return useMemo(() => {
    if (!sessionId) return "Ledger device";
    try {
      return dmk.getConnectedDevice({ sessionId }).name ?? "Ledger device";
    } catch {
      return "Ledger device";
    }
  }, [dmk, sessionId]);
}

const StateScreen: React.FC<{
  visual: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
}> = ({ visual, title, description, children }) => (
  <div className="flex flex-col items-center gap-32 text-center">
    <div className="flex flex-col items-center gap-24">
      {visual}
      <div className="flex flex-col gap-8">
        <h2 className="heading-4-semi-bold text-base">{title}</h2>
        {description ? (
          <p className="body-2 text-muted">{description}</p>
        ) : null}
      </div>
    </div>
    {children}
  </div>
);

const ConnectDevice: React.FC = () => {
  const { transportOptions, connectWithTransport } = useConnectDevice();
  return (
    <StateScreen
      visual={<Spot appearance="icon" icon={LedgerDevices} size={72} />}
      title="Ledger device required"
      description="Connect your Ledger device to continue. This step resumes once it is connected."
    >
      <div className="flex w-full flex-col gap-8">
        {transportOptions.map((option) => (
          <Button
            key={option.identifier}
            appearance="base"
            size="lg"
            isFull
            onClick={() => connectWithTransport(option.identifier)}
            data-testid={`contacts-device-connect-${option.identifier}`}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </StateScreen>
  );
};

/**
 * Runs a Contacts device operation step by step, showing the screens Ledger
 * Wallet shows: preparing, continue on device, and one screen per failure.
 * Without a device session it asks for one first, then starts on its own.
 */
export const DeviceStepDialog: React.FC<{
  operation: ContactsDeviceOperation;
  onClose: () => void;
  onDone: () => void;
}> = ({ operation, onClose, onDone }) => {
  const managers = useContactsManagers();
  const deviceName = useConnectedDeviceName();
  const [runState, setRunState] = useState<RunState>(initialRunState);
  // Bumped by Retry, to restart the failed step.
  const [attempt, setAttempt] = useState(0);
  // Each step's output, fed to the next step.
  const [outputs, setOutputs] = useState<unknown[]>([]);

  const stepIndex = runState.stepIndex;
  const isRunning = runState.type === "running";

  useEffect(() => {
    if (!managers || !isRunning) return;
    const step = operation.steps[stepIndex];
    if (!step) return;

    // Started on the next tick: React StrictMode mounts effects twice in dev,
    // and its immediate cleanup must not leave a device action half-sent.
    const start = () => {
      const { observable, cancel } = step.run(managers, outputs[stepIndex - 1]);
      const subscription = observable.subscribe((state) => {
        switch (state.status) {
          case DeviceActionStatus.Pending:
            setRunState({
              type: "running",
              stepIndex,
              interaction: state.intermediateValue.requiredUserInteraction,
            });
            break;
          case DeviceActionStatus.Completed:
            step.apply(state.output);
            if (stepIndex + 1 < operation.steps.length) {
              setOutputs((prev) => [...prev.slice(0, stepIndex), state.output]);
              setRunState({
                type: "running",
                stepIndex: stepIndex + 1,
                interaction: UserInteractionRequired.None,
              });
            } else {
              onDone();
            }
            break;
          case DeviceActionStatus.Error:
            setRunState({
              type: "error",
              stepIndex,
              screen: mapContactsError(state.error, operation.kind),
              details: describeContactsError(state.error),
            });
            break;
          case DeviceActionStatus.Stopped:
            setRunState({
              type: "error",
              stepIndex,
              screen: mapContactsError(undefined, operation.kind),
              details: "The device action was stopped.",
            });
            break;
          default:
            break;
        }
      });
      return () => {
        subscription.unsubscribe();
        cancel();
      };
    };
    let stop = () => {};
    const timer = setTimeout(() => {
      stop = start();
    }, 0);
    return () => {
      clearTimeout(timer);
      stop();
    };
    // `outputs` is read for the step being started only; a new output always
    // comes with a new step index, which restarts this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managers, operation, stepIndex, isRunning, attempt, onDone]);

  const retry = useCallback(() => {
    setRunState({
      type: "running",
      stepIndex,
      interaction: UserInteractionRequired.None,
    });
    setAttempt((n) => n + 1);
  }, [stepIndex]);

  const totalSteps = operation.steps.length;
  const stepCaption =
    totalSteps > 1
      ? `Step ${stepIndex + 1} of ${totalSteps} · ${operation.steps[stepIndex]?.label ?? ""}`
      : undefined;

  let content: React.ReactNode;
  if (!managers) {
    content = <ConnectDevice />;
  } else if (runState.type === "error") {
    const { screen, details } = runState;
    content = (
      <StateScreen
        visual={
          <Spot
            appearance={screen.kind === "rejected" ? "info" : "error"}
            size={72}
          />
        }
        title={screen.title}
        description={screen.description}
      >
        <div className="flex w-full flex-col gap-16">
          <div className="flex w-full gap-16">
            <Button
              appearance={screen.retryable ? "gray" : "base"}
              size="lg"
              isFull
              onClick={onClose}
              data-testid="contacts-device-close"
            >
              Close
            </Button>
            {screen.retryable ? (
              <Button
                appearance="base"
                size="lg"
                isFull
                onClick={retry}
                data-testid="contacts-device-retry"
              >
                Retry
              </Button>
            ) : null}
          </div>
          <details className="w-full text-left">
            <summary className="body-3 cursor-pointer text-muted">
              Error details
            </summary>
            <p
              className="body-3 mt-8 break-all text-muted"
              data-testid="contacts-device-error-details"
            >
              {details}
            </p>
          </details>
        </div>
      </StateScreen>
    );
  } else if (runState.interaction === UserInteractionRequired.None) {
    content = (
      <StateScreen
        visual={<Spinner size={32} />}
        title="Preparing your Ledger device"
        description={stepCaption}
      />
    );
  } else if (runState.interaction === UserInteractionRequired.UnlockDevice) {
    content = (
      <StateScreen
        visual={<Spot appearance="icon" icon={Devices} size={72} />}
        title={`Power on and unlock your ${deviceName}`}
        description={stepCaption}
      />
    );
  } else {
    const description =
      runState.interaction === UserInteractionRequired.ConfirmOpenApp &&
      operation.appName
        ? `Allow the ${operation.appName} app to open on your Secure Screen.`
        : "Follow the instructions displayed on your Secure Screen.";
    content = (
      <StateScreen
        visual={<Spot appearance="icon" icon={Devices} size={72} />}
        title={`Continue on your ${deviceName}`}
        description={
          stepCaption ? `${description} ${stepCaption}` : description
        }
      />
    );
  }

  return (
    <ContactsDialog
      onClose={onClose}
      className="w-[400px] bg-base pb-24"
      testId="contacts-device-dialog"
    >
      <DialogHeader density="compact" onClose={onClose} />
      <DialogBody className="px-24 pb-24">
        <div
          data-testid="contacts-device-state"
          data-state={!managers ? "no-device" : runState.type}
        >
          {content}
        </div>
      </DialogBody>
    </ContactsDialog>
  );
};
