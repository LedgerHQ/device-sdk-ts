This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deployment

The app runs as a container on Ledger's AWS infrastructure (see [`Dockerfile`](./Dockerfile)):

- A merge to `develop` deploys [app.devicesdk.ledger-test.com](https://app.devicesdk.ledger-test.com).
- A merge to `main` deploys [app.devicesdk.ledger.com](https://app.devicesdk.ledger.com).
- A pull request labelled `preview-sample` gets its own preview environment. The bot posts its URL on the pull request.

The workflows are in [`.github/workflows/sample-*.yml`](../../.github/workflows).
