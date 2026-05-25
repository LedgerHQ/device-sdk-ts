import {
  Account,
  ProgramManager,
  AleoKeyProvider,
  RecordPlaintext,
  SealanceMerkleTree,
  AleoNetworkClient,
  RecordScanner,
} from "@provablehq/sdk/mainnet.js";

// Configuration
const RECIPIENT =
  "aleo10ju2x3ktenzaacscg9rreln4q99rehh7plsnk8r6t300pgn49c8qqdrkqy";

// USDCx has 6 decimals: 1 USDCx = 1_000_000 base units
const TRANSFER_AMOUNT = 200; // 0.0002 USDCx

const nodeUrl = "https://api.provable.com/v2";
const proverUrl = "https://api.provable.com/prove";

async function buildFreezeListExclusionProof(
  networkClient: AleoNetworkClient,
  senderAddress: string,
): Promise<string> {
  // The Provable Explorer API returns 404 for usdcx_stablecoin.aleo ("No current freeze list found").
  // Read frozen addresses directly from the usdcx_freezelist.aleo on-chain mappings instead.

  // 1. Fetch total entry count. Returns null if the freeze list has never been written to.
  let frozenAddresses: string[] = [];
  const lastIndexRaw = await networkClient.getProgramMappingValue(
    "usdcx_freezelist.aleo",
    "freeze_list_last_index",
    "true",
  );

  if (lastIndexRaw != null) {
    const lastIndex = parseInt(String(lastIndexRaw).replace("u32", ""), 10);
    console.log(
      `** Freeze list has ${lastIndex + 1} entries. Fetching in parallel...`,
    );

    const entries = await Promise.all(
      Array.from({ length: lastIndex + 1 }, (_, i) =>
        networkClient.getProgramMappingValue(
          "usdcx_freezelist.aleo",
          "freeze_list_index",
          `${i}u32`,
        ),
      ),
    );
    frozenAddresses = entries.filter(Boolean) as string[];
  } else {
    console.log("** Freeze list is empty (no entries on-chain).");
  }

  // 2. Build the sorted Merkle tree.
  //    generateLeaves converts addresses → field elements, sorts, and pads to 2^maxDepth.
  const sealance = new SealanceMerkleTree();
  const leaves = sealance.generateLeaves(frozenAddresses, 15); // depth 15 → up to 32 768 entries
  const tree = sealance.buildTree(leaves);

  // 3. Find the two consecutive sorted leaves that bracket the sender (non-membership proof)
  const [leftIdx, rightIdx] = sealance.getLeafIndices(tree, senderAddress);
  const proofLeft = sealance.getSiblingPath(tree, leftIdx, 16); // depth=16 → siblings[0] is leaf
  const proofRight = sealance.getSiblingPath(tree, rightIdx, 16);

  // 4. Format as Leo [MerkleProof; 2u32] literal
  return sealance.formatMerkleProof([proofLeft, proofRight]);
}

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

  // Find unspent Token records with a positive balance
  const tokenRecords = (
    await recordScanner.findRecords({
      uuid: regResult.data.uuid,
      unspent: true,
      filter: {
        program: "usdcx_stablecoin.aleo",
        record: "Token",
      },
    })
  ).filter((r) => {
    try {
      // The scanner's filter.program is not enforced server-side — reject records from
      // other programs (e.g. token_registry.aleo Token has 4 entries, not 1).
      if (!r.record_plaintext || r.program_name !== "usdcx_stablecoin.aleo")
        return false;
      const plaintext = RecordPlaintext.fromString(r.record_plaintext);
      const amountStr = plaintext.getMember("amount").toString();
      const amount = BigInt(amountStr.replace("u128", ""));
      return amount > 0n;
    } catch {
      return false;
    }
  });

  console.log(`** ${tokenRecords.length} unspent Token records available`);

  if (tokenRecords.length === 0) {
    throw new Error("No unspent Token records available.");
  }

  const senderAddress = account.address().toString();
  console.log(
    `** Building freeze-list exclusion proof for sender ${senderAddress}...`,
  );
  const exclusionProof = await buildFreezeListExclusionProof(
    networkClient,
    senderAddress,
  );
  console.log("** Exclusion proof ready.");

  console.log(
    `** Sending transfer_private of ${TRANSFER_AMOUNT}u128 to ${RECIPIENT}...`,
  );

  const provingRequest = await programManager.provingRequest({
    programName: "usdcx_stablecoin.aleo",
    functionName: "transfer_private",
    priorityFee: 0,
    privateFee: false,
    inputs: [
      RECIPIENT,
      `${TRANSFER_AMOUNT}u128`,
      tokenRecords[0].record_plaintext!,
      exclusionProof,
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
