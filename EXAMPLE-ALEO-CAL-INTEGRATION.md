# Aleo CAL Integration — Usage Example

## Full integration (with CAL token metadata)

```typescript
import { ContextModuleBuilder } from "@ledgerhq/context-module";
import { SignerAleoBuilder } from "@ledgerhq/device-signer-kit-aleo";
import { firstValueFrom, last } from "rxjs";

// dmk and sessionId come from your DeviceManagementKit setup

// 1. Build the context module (default config hits prod CAL)
const contextModule = new ContextModuleBuilder()
  // Optionally override CAL config for staging/test:
  // .setCalConfig({ url: "https://crypto-assets-service.api.ledger.com/v1", mode: "test", branch: "main" })
  .build();

// 2. Build the signer, injecting the context module
const signer = new SignerAleoBuilder({ dmk, sessionId })
  .withContextModule(contextModule)
  .build();

// 3. Sign with token metadata — the CAL fetch happens automatically
const { observable } = signer.signRootIntent(
  "m/44'/1028'/0'/0'/0'",  // Aleo derivation path
  rootIntentBytes,          // Uint8Array of your serialized root intent
  {
    tokenInternalId: "aleo:usdc",         // CAL token ID
    programName: "token_registry.aleo",   // optional: specific program on the token registry
    skipOpenApp: false,
  },
);

// 4. Subscribe to the observable stream for intermediate UI states
observable.subscribe({
  next: ({ intermediateValue }) => {
    // intermediateValue.requiredUserInteraction tells you what to show the user
    // e.g. UserInteractionRequired.SignTransaction → prompt "Check your Ledger"
    console.log("User interaction needed:", intermediateValue.requiredUserInteraction);
  },
  error: (err) => console.error("Signing failed:", err),
  complete: () => console.log("Done"),
});

// 5. Get the final result (Either<SignRootIntentDAError, SignRootIntentCommandResponse>)
const result = await firstValueFrom(observable.pipe(last()));
result.caseOf({
  Right: (signature) => console.log("Signature:", signature),
  Left: (error) => console.error("Error:", error),
});
```

## Without CAL (no token metadata)

```typescript
const signer = new SignerAleoBuilder({ dmk, sessionId }).build();

signer.signRootIntent("m/44'/1028'/0'/0'/0'", rootIntentBytes, {
  skipOpenApp: false,
  // no tokenInternalId → hasTokenContext guard is false → goes straight to Sign
});
```

## Internal state machine flow (when tokenInternalId is provided)

```
InitialState
  → OpenApp (or skip via skipOpenApp)
  → CheckOpenAppResult
  → CheckTokenContext
      [hasTokenContext guard: tokenInternalId is non-empty AND contextModule is present]
      → BuildContext    ← calls BuildAleoTokenContextTask
                           → contextModule.getAleoContext({ tokenInternalId, programName, deviceModelId })
                           → HttpAleoTokenDataSource: GET /tokens?id=<tokenInternalId>&program_name=<programName>&...
      → ProvideContext  ← no-op placeholder (blocked on firmware confirming CMD_PROVIDE_TOKEN INS byte)
      → Sign
  → SignResultCheck
  → Success / Error
```

If the CAL fetch fails, the machine falls through to `Sign` anyway — signing is never blocked by a metadata failure.

## TransactionOptions reference

```typescript
type TransactionOptions = {
  skipOpenApp?: boolean;
  tokenInternalId?: string;   // CAL token ID, e.g. "aleo:usdc"
  programName?: string;       // optional CAL program name, e.g. "token_registry.aleo"
};
```
