import { type DeviceActionHandler } from "@ldmk/app/handlers/device-action/handlers/DeviceActionHandler";
import {
  type DeviceActionType,
  type DeviceActionTypes,
} from "@ldmk/app/handlers/device-action/handlers/DeviceActionType";
import { type AppState } from "@ldmk/app/state/AppState";
import { UserInteractionFormatter } from "@ldmk/app/utils/UserInteractionFormatter";
import {
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceManagementKit,
} from "@ledgerhq/device-management-kit";
import { type Observable } from "rxjs";

export abstract class BaseDeviceActionHandler<
  Output,
  Error,
  IntermediateValue extends DeviceActionIntermediateValue,
> implements DeviceActionHandler
{
  abstract type: DeviceActionTypes;
  abstract description: string;
  public abstract supports(type: DeviceActionType): boolean;
  protected abstract getObservable(): Promise<
    Observable<DeviceActionState<Output, Error, IntermediateValue>>
  >;
  protected abstract displayOutput(output: Output): void;

  constructor(
    protected readonly dmkInstance: DeviceManagementKit,
    protected readonly appState: AppState,
  ) {}

  private lastInteraction = "";

  public async handle(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.executeAndSubscribe(resolve).catch((error) => {
        this.displayError(error as Error);
        resolve(true);
      });
    });
  }

  private async executeAndSubscribe(
    resolve: (value: boolean) => void,
  ): Promise<void> {
    const observable = await this.getObservable();
    observable.subscribe({
      next: (state: DeviceActionState<Output, Error, IntermediateValue>) => {
        this.handleState(state);
      },
      complete: () => resolve(false),
      error: (error: unknown) => {
        this.displayError(error as Error);
        resolve(true);
      },
    });
  }

  private handleState(
    state: DeviceActionState<Output, Error, IntermediateValue>,
  ): void {
    switch (state.status) {
      case DeviceActionStatus.Pending:
        this.displayPendingInteraction(
          state.intermediateValue.requiredUserInteraction,
        );
        break;
      case DeviceActionStatus.Completed:
        this.displayOutput(state.output);
        break;
      case DeviceActionStatus.Error:
        this.displayError(state.error);
        break;
    }
  }

  private displayPendingInteraction(interaction: string | undefined): void {
    if (!interaction) return;
    const message = UserInteractionFormatter.format(interaction);
    if (message && message !== this.lastInteraction) {
      this.lastInteraction = message;
      console.log(chalk.yellow(message));
    }
  }

  private displayError(error: unknown): void {
    console.log(chalk.red("\nDevice action failed!"));
    console.log(
      chalk.red(
        error instanceof Error ? error.message : "Is your device connected?",
      ),
    );
  }
}
