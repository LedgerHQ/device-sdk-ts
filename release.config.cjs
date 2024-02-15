/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
  branches: [
    {
      name: "main",
    },
    {
      name: "feature/dsdk-66-changelog",
      channel: "channel-wip",
      prerelease: "wip",
    },
  ],
  extends: ["semantic-release-monorepo", "semantic-release-config-gitmoji"],
  plugins: [
    [
      "@semantic-release/npm",
      {
        npmPublish: false,
      },
    ],
  ],
};
