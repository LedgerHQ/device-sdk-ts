# Playwright spec patterns

Templates for each test family. Import fixtures from `@root/playwright/fixtures` in every spec.

## Shared boilerplate

```ts
/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";
```

## OS command test

**When to use:** spec mentions executing a command from the Commands view.

```ts
const DEVICE: DeviceConfig = {
  /* from spec — see device-configs.md */
};

interface CommandResponse {
  status: string;
  data?: {
    /* fields from spec */
  };
  error?: { _tag: string; errorCode: string; message: string };
}

test.describe("device command: {feature}", () => {
  test("{scenario title}", async ({ device, commands }) => {
    await test.step("Given …", async () => {
      await device.addAndConnect(DEVICE);
    });

    await test.step("When …", async () => {
      await commands.goto();
      await commands.execute("{Command label}", {
        inputField: "input-text_{fieldName}",
        inputValue: "{value}",
      });
    });

    await test.step("Then …", async () => {
      const response = await commands.lastResponse<CommandResponse>();
      expect(response.status).toBe("SUCCESS"); // or "ERROR" per spec
      // assertions from spec
    });
  });
});
```

**Command labels** must match the sample app UI title exactly (e.g. `"Get OS version"`, `"Open app"`, `"Get app and version"`).

**Open app** input: `{ inputField: "input-text_appName", inputValue: "Ethereum" }`.

**Slow Speculos open:** add `test.setTimeout(120_000)` and use `lastResponse({ timeout: 90_000 })`.

**Multiple sends on same command:** `commands.open("…")` once, then `commands.send()` + `commands.waitForResponseCount(n)` per execution. See `get-os-version_error-sequence_nano-x.spec.ts`.

**Close drawer between commands:** `commands.closeDrawer()`.

## Signer device-action test

**When to use:** spec mentions Ethereum or Bitcoin signer action.

```ts
test.describe("signer {chain}: {feature}", () => {
  test("{scenario title}", async ({ device, ethSigner }) => {
    test.setTimeout(120_000); // when app must open on Speculos

    await test.step("Given …", async () => {
      await device.addAndConnect(DEVICE_WITH_APP);
    });

    await test.step("When …", async () => {
      await ethSigner.open();
      await ethSigner.getAddress(); // or other driver method
    });

    await test.step("Then …", async () => {
      const result = await ethSigner.lastResult<OutputType>();
      expect(result.status).toBe("completed");
      expect(result.output!.field).toBe(EXPECTED_FROM_SPEC);
    });
  });
});
```

**Device action status values:** `"completed"` | `"error"` | `"pending"` (wait for terminal with `lastResult`).

## Signer + Speculos on-device approval

Add `speculos` fixture and capture `dev`:

```ts
let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

await test.step("Given …", async () => {
  dev = await device.addAndConnect(DEVICE_WITH_APP);
});

const emulator = speculos(dev);

await test.step("When … with on-device verification", async () => {
  await ethSigner.open();
  await ethSigner.getAddress({ checkOnDevice: true });
});

await test.step("And the action is approved on the Speculos screen", async () => {
  await emulator.waitReady();
  await emulator.approve(); // simple confirm
  // or await emulator.approveSigning(); // transaction/message review flow
});
```

**Speculos helpers:** `waitReady()`, `approve()`, `approveSigning()`, `enableBlindSigning()`.

## Device status / APDU mock test

**When to use:** spec mentions LOCKED/CONNECTED status or mocking an APDU.

```ts
const GET_APP_AND_VERSION_PREFIX = "b0010000";
const LOCKED_RESPONSE = "5515";

test.describe("device status: {feature}", () => {
  test("{scenario title}", async ({ device, mockClient, sidebar }) => {
    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given …", async () => {
      dev = await device.addAndConnect(DEVICE);
    });

    let mockId = "";
    await test.step("When …", async () => {
      const mock = await mockClient.addMock(dev.id, {
        prefix: GET_APP_AND_VERSION_PREFIX,
        response: LOCKED_RESPONSE,
      });
      mockId = mock.id;
    });

    await test.step("Then …", async () => {
      await sidebar.expectStatus("LOCKED");
    });

    await test.step("When the mock is removed", async () => {
      await mockClient.deleteMock(dev.id, mockId);
    });

    await test.step("Then …", async () => {
      await sidebar.expectStatus("CONNECTED");
    });
  });
});
```

## APDU mock before connect

When the spec seeds mocks before the device connects:

```ts
await test.step("Given … with a sequenced mock", async () => {
  const added = await device.add(DEVICE);
  await mockClient.addMock(added.id, {
    prefix: GET_OS_VERSION_PREFIX,
    responses: [OK_RESPONSE, OK_RESPONSE, ERROR_RESPONSE],
  });
  await device.connect();
});
```

## Parametrized scenarios

When the user provides a table of device/expectation pairs, use a `SCENARIOS` array and `for (const scenario of SCENARIOS)` with nested `test.describe`. See `get-os-version.spec.ts` and `open-app.spec.ts`.

## Settings test

```ts
import { test } from "@root/playwright/fixtures";

test.describe("settings: {feature}", () => {
  test("{title}", async ({ page, mockClient, settings }) => {
    await test.step("Given …", async () => {
      await page.goto("http://localhost:3000/settings");
    });

    await test.step("Then …", async () => {
      await settings.expectSessionTokenInput(mockClient.getToken()!);
    });
  });
});
```

## Fixtures import

Use `@root/playwright/fixtures` from any folder under `playwright/cases/`:

```ts
import { expect, test } from "@root/playwright/fixtures";
```
