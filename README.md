<p align="center">
 <img src="https://user-images.githubusercontent.com/9203826/154288895-670f5c23-81a1-4307-a080-1af83f7f8356.svg" align="center" alt="Ledger" />
 <h2 align="center">Web Device SDK</h2>
  <p align="center">
  <!-- Update with each individual package version -->
    <!-- Enable and display when CI set up -->
    <!-- <a href="https://github.com/LedgerHQ/platform-sdk/actions">
      <img alt="Tests Passing" src="https://github.com/LedgerHQ/platform-sdk/workflows/CI/badge.svg" />
    </a> -->
    <a href="https://www.typescriptlang.org/">
      <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
    </a>
    <a href="https://eslint.org/">
      <img alt="ESlint" src="https://img.shields.io/badge/eslint-3A33D1?style=for-the-badge&logo=eslint&logoColor=white" />
    </a>
    <a href="https://prettier.io/">
      <img alt="Prettier" src="https://img.shields.io/badge/prettier-1A2C34?style=for-the-badge&logo=prettier&logoColor=F7BA3E" />
    </a>
    <a href="https://jestjs.io/">
      <img alt="Jest" src="https://img.shields.io/badge/Jest-323330?style=for-the-badge&logo=Jest&logoColor=white" />
    </a>
<br />
    <a href="https://nextjs.org/">
      <img alt="NextJs" src="https://img.shields.io/badge/Next.js-000?logo=nextdotjs&logoColor=fff&style=for-the-badge" />
    </a>
    <a href="https://vercel.com/">
      <img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />
    </a>
    <a href="https://www.npmjs.com/">
      <img alt="NPM" src="https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white" />
    </a>
  </p>

  <p align="center">
    <a href="https://developers.ledger.com/docs/live-app/start-here/">Ledger Developer Portal</a>
    ·
    <a href="https://github.com/LedgerHQ/device-sdk-ts/issues/new/choose">Report Bug</a>
    ·
    <a href="https://github.com/LedgerHQ/device-sdk-ts/issues/new/choose">Request Feature</a>
  </p>
  <!-- Also add monorepo docuzaurus doc when available -->
</p>

# About

This monorepo hosts the Device SDK for Web. 
Written in Typescript.


# How does it works

The Device SDK defines an interface for applications to interact with Ledger wallets.

```mermaid
  flowchart LR;
      application(Application) <--JSON-RPC--> wallet(Wallet);
```

<!-- TODO: link to reference implementations of client and server once available -->


# Modules description

This project uses [turbo monorepo](https://turbo.build/repo/docs) to build and release different packages on NPM registry and a sample demo app on Vercel.  

A brief description of this project packages:

* `@ledgerhq/device-sdk-sample` in `apps/sample`: React Next web app used to test & demonstrate the Web Device SDK
* `@ledgerhq/eslint-config-dsdk` in `packages/config/eslint`: internal package which contains eslint shared config. Used by `extends: ["@ledgerhq/dsdk"]` in `.eslintrc`.
* `@ledgerhq/jest-config-dsdk` in `packages/config/jest`: internal package which contains jest shared config. Used by `preset: "@ledgerhq/jest-config-dsdk"` in `jest.config.ts`
* `@ledgerhq/tsconfig-dsdk` in `packages/config/typescript`: internal package which contains typescript shared config. Used by `"extends": "@ledgerhq/tsconfig-dsdk/sdk"` in `tsconfig.json`
* `@ledgerhq/device-sdk-core` in `packages/core`: external package that contains the core of the Web SDK
* `@ledgerhq/device-sdk-signer` in `packages/signer`: external package
* `@ledgerhq/device-sdk-trusted-apps` in `packages/trusted-apps`: external package
* `@ledgerhq/device-sdk-ui` in `packages/ui`: external package


# CI

This project uses Github CI. 


# Scripting

In order to avoid task repetition, we can add some scripts the corresponding package's script folder, on in a root script folder if it concerns multiple packages.
A script is a `.mjs` file interpreted by [zx](https://github.com/google/zx).


