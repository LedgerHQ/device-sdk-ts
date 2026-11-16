# Device Management Kit DevTools

A standalone Electron desktop application for monitoring integrations of the Device Management Kit.
This app connects to your app integrating the Device Management Kit via WebSocket to provide real-time logging, device interaction monitoring, and debugging capabilities.

Go to [Device Management Kit README](../../packages/device-management-kit/README.md#developer-tools) for more informations on setup and usage.

## AI debugging

Select logs or APDUs and press **Explain with AI**: Claude explains what happened, why, and what to try next. It needs:

- [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and signed in on the computer. The app uses that login, through `@anthropic-ai/claude-agent-sdk`, and has no key of its own.
- For **Read the code**: the app running from this repository (`pnpm dev`), so Claude can read DMK's source. A packaged app only has the Quick mode.
- For **Create Jira ticket**: the Atlassian connector connected in Claude (claude.ai › Settings › Connectors). Tickets are filed in `DSDK`.

The skills Claude uses are in `resources/ai`. File reads stay inside that folder, and inside the repository in Read the code mode; files that may hold secrets (`.env*`, keys…) are never read.

## APDU command names

The Inspector names each APDU after its command, from tables generated from the command classes of DMK, the signers and the trusted apps. After adding or changing a command, regenerate them:

```bash
$ pnpm --filter @ledgerhq/device-management-kit-devtools-ui generate:apdu-commands
```

It also updates `resources/ai/skills/apdu-commands/commands.md`.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
