import {
  Account,
  ProgramManager,
  AleoKeyProvider,
  RecordPlaintext,
  AleoNetworkClient,
  RecordScanner,
} from "@provablehq/sdk/mainnet.js";

// Configuration
const RECIPIENT =
  "aleo10ju2x3ktenzaacscg9rreln4q99rehh7plsnk8r6t300pgn49c8qqdrkqy";

// USDC has 6 decimals: 1 USDC = 1_000_000 base units
const TRANSFER_AMOUNT = 200; // 0.0002 USDC

const USDC_TOKEN_ID =
  "4697275201844475848710842677807162058146139844643350200269139278887318953049field";

const nodeUrl = "https://api.provable.com/v2";
const proverUrl = "https://api.provable.com/prove";

async function sendPrivateTokenTransfer() {
  const account = new Account({
    privateKey: process.env.ALEO_LEDGER_1_PRIVATE_KEY,
  });
  const networkClient = new AleoNetworkClient(nodeUrl);
  networkClient.setProverUri(proverUrl);

  const recordScanner = new RecordScanner({
    url: "https://api.provable.com/scanner",
    apiKey: process.env.PROVABLE_API_KEY,
    consumerId: process.env.PROVABLE_CONSUMER_ID,
    account,
    decryptEnabled: true,
    autoReRegister: true,
  });

  const regResult = await recordScanner.register(account.viewKey(), 0);
  if (!regResult.ok) {
    throw new Error(
      `Registration failed: ${(regResult as any).error?.message ?? "unknown error"}`,
    );
  }
  console.log(`** Registered. UUID: ${regResult.data.uuid}`);

  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);

  const programManager = new ProgramManager(
    nodeUrl,
    keyProvider,
    recordScanner,
  );
  programManager.setAccount(account);

  // Find unspent Token records for USDC from token_registry.aleo
  const tokenRecords = (
    await recordScanner.findRecords({
      uuid: regResult.data.uuid,
      unspent: true,
      filter: {
        program: "token_registry.aleo",
        record: "Token",
      },
    })
  ).filter((r) => {
    try {
      if (!r.record_plaintext || r.program_name !== "token_registry.aleo")
        return false;
      const plaintext = RecordPlaintext.fromString(r.record_plaintext);
      const tokenId = plaintext.getMember("token_id").toString();
      const amount = BigInt(
        plaintext.getMember("amount").toString().replace("u128", ""),
      );
      return tokenId === USDC_TOKEN_ID && amount > 0n;
    } catch {
      return false;
    }
  });

  console.log(`** ${tokenRecords.length} unspent USDC Token records available`);

  if (tokenRecords.length === 0) {
    throw new Error("No unspent USDC Token records available.");
  }

  console.log(
    `** Sending transfer_private of ${TRANSFER_AMOUNT}u128 USDC to ${RECIPIENT}...`,
  );

  // token_registry.aleo transfer_private: (recipient: address, amount: u128, tokenRecord: Token)
  // No Merkle/freeze-list proof needed — USDC has external_authorization_required: false
  const provingRequest = await programManager.provingRequest({
    programName: "token_registry.aleo",
    functionName: "transfer_private",
    priorityFee: 0,
    privateFee: false,
    inputs: [
      RECIPIENT,
      `${TRANSFER_AMOUNT}u128`,
      tokenRecords[0].record_plaintext!,
    ],
    broadcast: true,
  });

  console.log(`** Submitting proving request...`);

  const result = await networkClient.submitProvingRequestSafe({
    provingRequest,
    dpsPrivacy: false,
    apiKey: process.env.PROVABLE_API_KEY,
    consumerId: process.env.PROVABLE_CONSUMER_ID,
  });

  console.log(
    `***** [${new Date().toISOString()}] transfer_private - ${
      result.ok ? result.data.transaction.id : `Error: ${result.error.message}`
    }`,
  );
}

sendPrivateTokenTransfer().catch(console.error);
