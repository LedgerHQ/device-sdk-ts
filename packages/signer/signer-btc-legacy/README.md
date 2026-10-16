# Ledger Bitcoin Legacy Signer Implementation

This module provides the implementation of the Ledger signer of the Device Management Kit for the apps on the legacy Bitcoin protocol (CLA `0xE0`), such as Litecoin, Dogecoin or Bitcoin Cash. Each coin is a profile of this kit: its app name and its error map.

It also exports its inversify module (`btcLegacyModuleFactory`), its tokens (`btcLegacyTypes`) and its services, for the signer kits built on the same protocol, such as `@ledgerhq/device-signer-kit-zcash`.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-bitcoin-legacy
```
