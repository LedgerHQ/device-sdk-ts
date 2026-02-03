import { input } from "@inquirer/prompts";
import { ApduBuilder, ApduParser } from "@ledgerhq/device-management-kit";
import { useDmk } from "../services";
import { state, deviceConnected, deviceLocked } from "../state";
import { logSuccess, logInfo, logError } from "../utils";
import { ListenForCommand } from "../utils/Constants";

export const handleSendApdu = async (listenForCommand: ListenForCommand): Promise<void> => {
  if (!deviceConnected()) {
    logError("\nNo device connected! Please, first connect to a device.\n");
    return listenForCommand();
  }
  
  const CLA = await input({ message: "Enter CLA (e.g., E0)" });
  const INS = await input({ message: "Enter INS (e.g., 01)" });
  const P1 = await input({ message: "Enter P1 (e.g., 00)" });
  const P2 = await input({ message: "Enter P2 (e.g., 00)" });

  const apduBuilder = new ApduBuilder({
    cla: parseInt(CLA, 16),
    ins: parseInt(INS, 16),
    p1: parseInt(P1, 16),
    p2: parseInt(P2, 16),
  });
  const apdu = apduBuilder.build();

  try {
    const response = await useDmk().sendApdu({
      sessionId: state.sessionId!,
      apdu: apdu.getRawApdu(),
    });

    const apduParser = new ApduParser(response);

    logSuccess("\nAPDU sent successfully!");
    logInfo(`Response status: ${apduParser.encodeToHexaString(response.statusCode)}`);
    logInfo(`Response data: ${apduParser.encodeToHexaString(response.data)}`);
    logInfo("\n");
  } catch (error) {
    logError("Error sending APDU:");
    console.error(error);
  }

  return listenForCommand();
};
