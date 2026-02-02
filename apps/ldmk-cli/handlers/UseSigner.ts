import { DeviceActionStatus } from "@ledgerhq/device-management-kit";
import { SignerEthBuilder, type SignerEth } from "@ledgerhq/device-signer-kit-ethereum";
import { input, select } from "@inquirer/prompts";
import { Observable } from "rxjs";

import { useDmk } from "../services";
import { deviceConnected, deviceLocked, state } from "../state";
import { logError, logInfo, logSuccess } from "../utils";
import { ListenForCommand } from "../utils/Constants";

// Default values from sample app
const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";
const DEFAULT_CHAIN_ID = 1;
const DEFAULT_MESSAGE = "Hello World";
const DEFAULT_TYPED_MESSAGE = `{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}`;

type SignerType = "EthSigner" | "Cancel";

type EthSignerAction =
  | "getAddress"
  | "verifySafeAddress"
  | "signMessage"
  | "signTransaction"
  | "signTypedData"
  | "signDelegationAuthorization"
  | "Cancel";

interface SignerChoice {
  name: SignerType;
  description: string;
}

interface EthSignerActionChoice {
  name: EthSignerAction;
  description: string;
}

const signerChoices: SignerChoice[] = [
  { name: "EthSigner", description: "Ethereum Signer" },
  { name: "Cancel", description: "Return to the main menu" },
];

const ethSignerActions: EthSignerActionChoice[] = [
  { name: "getAddress", description: "Get Ethereum address" },
  { name: "verifySafeAddress", description: "Verify Safe address" },
  { name: "signMessage", description: "Sign a personal message" },
  { name: "signTransaction", description: "Sign a transaction" },
  { name: "signTypedData", description: "Sign typed data (EIP-712)" },
  { name: "signDelegationAuthorization", description: "Sign delegation authorization" },
  { name: "Cancel", description: "Return to signer selection" },
];

// Helper function to prompt yes/no and convert to boolean
const promptYesNo = async (message: string, defaultValue: boolean): Promise<boolean> => {
  const defaultText = defaultValue ? "yes" : "no";
  const response = await input({
    message: `${message} (yes/no, default: ${defaultText})`,
  });
  if (response.trim() === "") {
    return defaultValue;
  }
  return response.toLowerCase() === "yes" || response.toLowerCase() === "y";
};

// Helper function to convert hex string to Uint8Array
const hexStringToUint8Array = (hex: string): Uint8Array => {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (cleanHex.length === 0) {
    return new Uint8Array(0);
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
};

// Generic function to handle device action state
const digestSignerActionState = (
  actionName: string,
  actionState: { status: string; intermediateValue?: unknown; output?: unknown; error?: unknown }
): void => {
  switch (actionState.status) {
    case DeviceActionStatus.NotStarted:
      logInfo("Action not started yet...");
      break;

    case DeviceActionStatus.Pending: {
      const intermediateValue = actionState.intermediateValue as { requiredUserInteraction?: string } | undefined;
      if (intermediateValue?.requiredUserInteraction && intermediateValue.requiredUserInteraction !== "none") {
        logInfo(`User interaction required: ${intermediateValue.requiredUserInteraction}`);
      }
      break;
    }

    case DeviceActionStatus.Stopped:
      logInfo("Action stopped.");
      break;

    case DeviceActionStatus.Completed:
      logSuccess(`\n${actionName} completed successfully!`);
      digestSignerOutput(actionName, actionState.output);
      break;

    case DeviceActionStatus.Error:
      logError(`\n${actionName} failed!`);
      digestSignerError(actionState.error);
      break;
  }
};

// Display output based on action type
const digestSignerOutput = (actionName: string, output: unknown): void => {
  if (!output) {
    logInfo("No output received.\n");
    return;
  }

  switch (actionName) {
    case "getAddress": {
      const data = output as { publicKey: string; address: string; chainCode?: string };
      logInfo(`Address: ${data.address}`);
      logInfo(`Public Key: ${data.publicKey}`);
      if (data.chainCode) {
        logInfo(`Chain Code: ${data.chainCode}`);
      }
      logInfo("");
      break;
    }
    case "verifySafeAddress":
      logInfo("Safe address verified successfully.\n");
      break;
    case "signMessage":
    case "signTransaction":
    case "signTypedData":
    case "signDelegationAuthorization": {
      const signature = output as { r: string; s: string; v: number };
      logInfo(`Signature:`);
      logInfo(`  r: ${signature.r}`);
      logInfo(`  s: ${signature.s}`);
      logInfo(`  v: ${signature.v}`);
      logInfo("");
      break;
    }
    default:
      logInfo(`Output: ${JSON.stringify(output, null, 2)}\n`);
  }
};

// Display error details
const digestSignerError = (error: unknown): void => {
  if (error && typeof error === "object") {
    if ("_tag" in error) {
      logError(`Error type: ${(error as { _tag: string })._tag}`);
    }
    if ("message" in error && typeof (error as { message: unknown }).message === "string") {
      logError(`Message: ${(error as { message: string }).message}`);
    }
    if (
      "originalError" in error &&
      (error as { originalError: unknown }).originalError instanceof Error
    ) {
      logError(`Original error: ${((error as { originalError: Error }).originalError).message}`);
    }
  } else {
    logError(`Error: ${String(error)}`);
  }
  logInfo("");
};

// Execute and subscribe to observable
const executeAndSubscribe = <T>(
  actionName: string,
  observable: Observable<{ status: string; intermediateValue?: unknown; output?: T; error?: unknown }>
): Promise<void> => {
  let lastInteraction = "";

  return new Promise<void>((resolve, reject) => {
    observable.subscribe({
      next: (actionState) => {
        // Only log interaction messages when they change to avoid spam
        if (actionState.status === DeviceActionStatus.Pending) {
          const intermediateValue = actionState.intermediateValue as { requiredUserInteraction?: string } | undefined;
          const currentInteraction = intermediateValue?.requiredUserInteraction ?? "";
          if (currentInteraction !== lastInteraction) {
            lastInteraction = currentInteraction;
            digestSignerActionState(actionName, actionState);
          }
        } else if (
          actionState.status === DeviceActionStatus.Completed ||
          actionState.status === DeviceActionStatus.Error
        ) {
          digestSignerActionState(actionName, actionState);
        }
      },
      complete: () => resolve(),
      error: (err) => reject(err),
    });
  });
};

// Get address action
const handleGetAddress = async (signer: SignerEth): Promise<void> => {
  const derivationPath = await input({
    message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
  });
  const checkOnDevice = await promptYesNo("Check on device", false);
  const returnChainCode = await promptYesNo("Return chain code", false);
  const skipOpenApp = await promptYesNo("Skip open app", false);

  const { observable } = signer.getAddress(derivationPath || DEFAULT_DERIVATION_PATH, {
    checkOnDevice,
    returnChainCode,
    skipOpenApp,
  });

  await executeAndSubscribe("getAddress", observable);
};

// Verify safe address action
const handleVerifySafeAddress = async (signer: SignerEth): Promise<void> => {
  const safeContractAddress = await input({
    message: "Safe contract address (default: empty)",
  });
  const chainIdStr = await input({
    message: `Chain ID (default: ${DEFAULT_CHAIN_ID})`,
  });
  const skipOpenApp = await promptYesNo("Skip open app", false);

  const chainId = chainIdStr ? parseInt(chainIdStr, 10) : DEFAULT_CHAIN_ID;

  const { observable } = signer.verifySafeAddress(safeContractAddress || "", {
    chainId,
    skipOpenApp,
  });

  await executeAndSubscribe("verifySafeAddress", observable);
};

// Sign message action
const handleSignMessage = async (signer: SignerEth): Promise<void> => {
  const derivationPath = await input({
    message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
  });
  const message = await input({
    message: `Message (default: ${DEFAULT_MESSAGE})`,
  });
  const skipOpenApp = await promptYesNo("Skip open app", false);

  const { observable } = signer.signMessage(
    derivationPath || DEFAULT_DERIVATION_PATH,
    message || DEFAULT_MESSAGE,
    { skipOpenApp }
  );

  await executeAndSubscribe("signMessage", observable);
};

// Sign transaction action
const handleSignTransaction = async (signer: SignerEth): Promise<void> => {
  const derivationPath = await input({
    message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
  });
  const transactionHex = await input({
    message: "Transaction (hex encoded, e.g., 0x...)",
  });
  const recipientDomain = await input({
    message: "Recipient domain (default: empty)",
  });
  const skipOpenApp = await promptYesNo("Skip open app", false);

  const transaction = hexStringToUint8Array(transactionHex);

  const { observable } = signer.signTransaction(
    derivationPath || DEFAULT_DERIVATION_PATH,
    transaction,
    { domain: recipientDomain || undefined, skipOpenApp }
  );

  await executeAndSubscribe("signTransaction", observable);
};

// Sign typed data action
const handleSignTypedData = async (signer: SignerEth): Promise<void> => {
  const derivationPath = await input({
    message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
  });
  const messageInput = await input({
    message: "Typed data JSON (default: sample EIP-712 Permit message)",
  });
  const skipOpenApp = await promptYesNo("Skip open app", false);

  const messageJson = messageInput || DEFAULT_TYPED_MESSAGE;

  try {
    const typedData = JSON.parse(messageJson);
    const { observable } = signer.signTypedData(
      derivationPath || DEFAULT_DERIVATION_PATH,
      typedData,
      { skipOpenApp }
    );

    await executeAndSubscribe("signTypedData", observable);
  } catch (e) {
    logError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
};

// Sign delegation authorization action
const handleSignDelegationAuthorization = async (signer: SignerEth): Promise<void> => {
  const derivationPath = await input({
    message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
  });
  const nonceStr = await input({
    message: "Nonce (default: 0)",
  });
  const contractAddress = await input({
    message: "Contract address (default: 0x)",
  });
  const chainIdStr = await input({
    message: `Chain ID (default: ${DEFAULT_CHAIN_ID})`,
  });

  const nonce = nonceStr ? parseInt(nonceStr, 10) : 0;
  const chainId = chainIdStr ? parseInt(chainIdStr, 10) : DEFAULT_CHAIN_ID;

  const { observable } = signer.signDelegationAuthorization(
    derivationPath || DEFAULT_DERIVATION_PATH,
    chainId,
    contractAddress || "0x",
    nonce
  );

  await executeAndSubscribe("signDelegationAuthorization", observable);
};

// Handle Eth Signer actions
const handleEthSigner = async (listenForCommand: ListenForCommand): Promise<void> => {
  const dmk = useDmk();
  const signer = new SignerEthBuilder({
    dmk,
    sessionId: state.sessionId!,
  }).build();

  const actionLoop = async (): Promise<void> => {
    const action = await select<EthSignerAction>({
      message: "Select an Ethereum Signer action",
      choices: ethSignerActions.map((a) => ({
        name: a.description,
        value: a.name,
      })),
    });

    if (action === "Cancel") {
      return handleUseSigner(listenForCommand);
    }

    try {
      switch (action) {
        case "getAddress":
          await handleGetAddress(signer);
          break;
        case "verifySafeAddress":
          await handleVerifySafeAddress(signer);
          break;
        case "signMessage":
          await handleSignMessage(signer);
          break;
        case "signTransaction":
          await handleSignTransaction(signer);
          break;
        case "signTypedData":
          await handleSignTypedData(signer);
          break;
        case "signDelegationAuthorization":
          await handleSignDelegationAuthorization(signer);
          break;
      }
    } catch (error: unknown) {
      logError(
        `Error executing signer action: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }

    return actionLoop();
  };

  return actionLoop();
};

// Main handler for Use Signer command
export const handleUseSigner = async (
  listenForCommand: ListenForCommand
): Promise<void> => {
  if (!deviceConnected()) {
    logError("\nNo device connected! Please, first connect to a device.\n");
    return listenForCommand();
  }

  if (deviceLocked()) {
    logError("\nDevice locked! Please, first unlock your device.\n");
    return listenForCommand();
  }

  const choice = await select<SignerType>({
    message: "Select a signer to use",
    choices: signerChoices.map((s) => ({
      name: s.description,
      value: s.name,
    })),
  });

  if (choice === "Cancel") {
    return listenForCommand();
  }

  switch (choice) {
    case "EthSigner":
      return handleEthSigner(listenForCommand);
     default: 
      return listenForCommand();
  }
};
