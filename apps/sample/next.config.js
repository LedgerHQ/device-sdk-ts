/** @type {import('next').NextConfig} */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withSentryConfig } = require("@sentry/nextjs");

const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true,
  },
  env: {
    SDK_CONFIG_TRANSPORT:
      process.env.npm_lifecycle_event === "dev:default-mock"
        ? "MOCK_SERVER"
        : "",
  },
};

// Define Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  silent: true,
  org: "ledger",
  project: "device-sdk-sample",

  // Additional Sentry options
  widenClientFileUpload: true, // Upload a larger set of source maps for prettier stack traces (increases build time)
  transpileClientSDK: true, // Transpiles SDK to be compatible with IE11 (increases bundle size)
  tunnelRoute: "/monitoring", // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
  hideSourceMaps: true, // Hides source maps from generated client bundles
  disableLogger: true, // Automatically tree-shake Sentry logger statements to reduce bundle size
  automaticVercelMonitors: true, // Enables automatic instrumentation of Vercel Cron Monitors
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
