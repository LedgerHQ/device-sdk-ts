# Device Management Kit DevTools

A standalone Electron desktop application for monitoring integrations of the Device Management Kit.
This app connects to your app integrating the Device Management Kit via WebSocket to provide real-time logging, device interaction monitoring, and debugging capabilities.

Go to [Device Management Kit README](../../packages/device-management-kit/README.md#developer-tools) for more informations on setup and usage.

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
