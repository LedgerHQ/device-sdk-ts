import "zx/globals";

import { input } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import {
  ActionHandler,
  ConnectionMode,
} from "@ldmk/app/handlers/ActionHandler";
import { ActionType, ActionTypes } from "@ldmk/app/handlers/ActionType";
import { AppState } from "@ldmk/app/state/AppState";
import {
  ApduBuilder,
  DeviceManagementKit,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class SendApduActionHandler implements ActionHandler {
  readonly type = ActionTypes.SEND_APDU;
  readonly description = "Send a raw APDU command to the device";
  readonly connectionMode = ConnectionMode.CONNECTED;

  constructor(
    @inject(appTypes.DMKInstance)
    private readonly dmkInstance: DeviceManagementKit,
    @inject(appTypes.AppState)
    private readonly appState: AppState,
  ) {}

  public supports(action: ActionType): boolean {
    return action === this.type;
  }

  public async handle(): Promise<boolean> {
    const apdu = await this.enterApdu();
    await this.sendApdu(apdu);
    return false;
  }

  private async enterApdu(): Promise<{
    cla: string;
    ins: string;
    p1: string;
    p2: string;
  }> {
    const cla = await input({ message: "Enter CLA (e.g., E0)" });
    const ins = await input({ message: "Enter INS (e.g., 01)" });
    const p1 = await input({ message: "Enter P1 (e.g., 00)" });
    const p2 = await input({ message: "Enter P2 (e.g., 00)" });

    return {
      cla,
      ins,
      p1,
      p2,
    };
  }

  private async sendApdu(apdu: {
    cla: string;
    ins: string;
    p1: string;
    p2: string;
  }): Promise<void> {
    try {
      const apduResponse = await this.dmkInstance.sendApdu({
        sessionId: this.appState.getDeviceSessionId()!,
        apdu: new ApduBuilder({
          cla: parseInt(apdu.cla, 16),
          ins: parseInt(apdu.ins, 16),
          p1: parseInt(apdu.p1, 16),
          p2: parseInt(apdu.p2, 16),
        })
          .build()
          .getRawApdu(),
      });
      const toHex = (arr: Uint8Array) =>
        Array.from(arr)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      console.log(chalk.green("APDU sent successfully!"));
      console.log(
        chalk.grey(`  Response status: ${toHex(apduResponse.statusCode)}`),
      );
      console.log(chalk.grey(`  Response data: ${toHex(apduResponse.data)}`));
    } catch (error) {
      console.log(chalk.red("Error sending APDU:"));
      console.log(
        chalk.red(
          error instanceof Error ? error.message : "Is your device connected?",
        ),
      );
    }
  }
}
