# @ledgerhq/dmk-ledger-wallet

> [!CAUTION]
> This package is destined to be used only in Ledger Wallet. Other applications do not need those features.

## Description

This package provides advanced device actions specifically designed for Ledger Wallet applications. It extends the capabilities of `@ledgerhq/device-management-kit` with specialized functionality that is only needed by Ledger Wallet products.

## Why a Separate Package?

This package exists separately from the Device Management Kit (DMK) for the following reasons:

- **Targeted audience**: The device actions in this package are specifically designed for Ledger Wallet applications. Other consumers of the DMK (third-party apps, dApps, etc.) do not need these features.
- **Reduced bundle size**: By keeping these specialized features in a separate package, consumers who don't need them avoid unnecessary code in their bundles.
- **Clear boundaries**: Separating Ledger Wallet-specific functionality makes it clear which features are for general use versus internal Ledger products.

## Installation

```sh
npm install @ledgerhq/dmk-ledger-wallet
```

This package requires `@ledgerhq/device-management-kit` as a peer dependency:

```sh
npm install @ledgerhq/device-management-kit
```
