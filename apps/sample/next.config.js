/** @type {import('next').NextConfig} */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withSentryConfig } = require("@sentry/nextjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

const API_URL = process.env.API_URL || "http://127.0.0.1:5328";

// Container (EKS) builds set BUILD_STANDALONE=true; Vercel builds are unaffected.
const standalone =
  process.env.BUILD_STANDALONE === "true"
    ? {
        output: "standalone",
        // Trace workspace packages from the monorepo root.
        outputFileTracingRoot: path.join(__dirname, "../../"),
      }
    : {};

const nextConfig = {
  ...standalone,
  reactStrictMode: true,
  compiler: {
    styledComponents: true,
  },
  env: {
    // Expose the transport selector to the browser bundle. Defaults to the mock
    // server transport when the app is started via `dev:default-mock`.
    DMK_CONFIG_TRANSPORT:
      process.env.DMK_CONFIG_TRANSPORT ||
      (process.env.npm_lifecycle_event === "dev:default-mock"
        ? "mockserver"
        : ""),
  },
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        // In the container the Flask API runs in the same pod (API_URL set at
        // build time); on Vercel it is served by the Python function at /api/.
        destination:
          process.env.NODE_ENV === "development" || process.env.API_URL
            ? `${API_URL}/api/:path*`
            : "/api/",
      },
    ];
  },
};

// Define Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  silent: true,
  org: "ledger",
  project: "device-management-kit-sample",

  // Additional Sentry options
  widenClientFileUpload: true, // Upload a larger set of source maps for prettier stack traces (increases build time)
  transpileClientSDK: true, // Transpiles SDK to be compatible with IE11 (increases bundle size)
  tunnelRoute: "/monitoring", // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
  hideSourceMaps: true, // Hides source maps from generated client bundles
  disableLogger: true, // Automatically tree-shake Sentry logger statements to reduce bundle size
  automaticVercelMonitors: true, // Enables automatic instrumentation of Vercel Cron Monitors
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
