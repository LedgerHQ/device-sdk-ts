# Extending Playwright drivers

Add methods when the WHEN step references an interaction not yet covered by an existing driver. Do **not** modify the sample React app — leave a TODO if the UI may lack the test id.

Drivers fall into two families:

- **UI drivers** — drive the sample React app via Playwright `page` and `data-testid` selectors. Extend these for new routes, command drawers, signer actions, or on-screen assertions.
- **Non-UI drivers** — talk to external systems (Speculos emulator, mock server). No sample-app testids; different APIs and extension rules.

Only add to `fixtures.ts` if introducing a genuinely new driver class (rare).

## UI drivers (sample app)

| Domain                  | File                                                          | Fixture         |
| ----------------------- | ------------------------------------------------------------- | --------------- |
| OS commands             | `apps/sample/playwright/utils/drivers/CommandsDriver.ts`      | `commands`      |
| OS device actions       | `apps/sample/playwright/utils/drivers/DeviceActionsDriver.ts` | `deviceActions` |
| Ethereum signer         | `apps/sample/playwright/utils/drivers/EthSignerDriver.ts`     | `ethSigner`     |
| Bitcoin signer          | `apps/sample/playwright/utils/drivers/BtcSignerDriver.ts`     | `btcSigner`     |
| Settings                | `apps/sample/playwright/utils/drivers/SettingsDriver.ts`      | `settings`      |
| Sidebar / device status | `apps/sample/playwright/utils/drivers/SidebarDriver.ts`       | `sidebar`       |

### testid conventions (sample app)

From `apps/sample/src/components/ClickableListItem.tsx`:

- Command/action list item: `CTA_command-{UI title}` (exact title, case-sensitive)
- Route navigation: `CTA_route-to-{path}` (e.g. `CTA_route-to-/commands`)
- Text inputs: `input-text_{fieldName}`
- Switches: `input-switch_{fieldName}`
- Send button (commands): `CTA_send-device-command`
- Send button (device actions): `CTA_send-device-action`
- Device status: `text_device-connection-status`

### Signer action method template

Match `EthSignerDriver.getAddress` style:

```ts
/**
 * Open the {Action label} action and Execute it.
 */
async myAction({
  someOption = false,
}: { someOption?: boolean } = {}): Promise<void> {
  await this.page.getByTestId("CTA_command-{Action label}").click();
  if (someOption) {
    await this.page.getByTestId("input-switch_{fieldName}").click();
  }
  // Fill inputs if needed:
  // const input = this.page.getByTestId("input-text_{field}");
  // await input.waitFor({ state: "visible" });
  // await input.fill(value);
  await this.page.getByTestId("CTA_send-device-action").click();
}
```

`lastResult<Output>()` already exists on signer drivers — reuse it, do not duplicate.

### Device action method template

Match `DeviceActionsDriver.waitForAppAndVersion` style (same testids, `CTA_send-device-action`):

```ts
/**
 * Open the {Action label} action and Execute it.
 */
async myAction(): Promise<void> {
  await this.page.getByTestId("CTA_command-{Action label}").click();
  await this.page.getByTestId("CTA_send-device-action").click();
}
```

`lastResult<Output>()` and `expectRequiredUserInteraction()` already exist on `DeviceActionsDriver` — reuse them.

### Command execute vs custom method

Prefer `commands.execute("Command label", params)` for standard commands. Add a `CommandsDriver` method only when the interaction is repetitive or non-standard (multi-step, reuse across specs).

## Non-UI drivers

| Driver      | File                                                       | Fixture         | When to extend                |
| ----------- | ---------------------------------------------------------- | --------------- | ----------------------------- |
| Speculos    | `apps/sample/playwright/utils/drivers/SpeculosDriver.ts`   | `speculos(dev)` | New on-device screen flows    |
| Mock device | `apps/sample/playwright/utils/drivers/MockDeviceDriver.ts` | `device`        | Rare — session lifecycle only |

`SpeculosDriver` is constructed after connect: `const dev = await device.addAndConnect(…); const emulator = speculos(dev);`

### Speculos method template

Add to `SpeculosDriver` only for new screen flows not covered by `approve()`, `approveSigning()`, or `enableBlindSigning()`. Follow existing marker-based navigation (`includesAny`, screen text polling). Do **not** use `page.getByTestId` — interactions go through the Speculos device controller API.

## Missing UI

If the action label is unknown or the sample app may not expose it yet:

```ts
// TODO: requires CTA_command-{Action label} in sample app
```

Tell the user the driver was added but the sample app may need a corresponding list item.
