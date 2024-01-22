#!/usr/bin/env zx
import "zx/globals";
import { basename } from "node:path";
const features = argv._;

if (!features.length) {
  console.error(`Usage: ${basename(__filename)} <feature1> [<feature2> ...]`);
  process.exit(1);
}

within(async () => {
  cd("src/internal");
  for (const feature of features) {
    const rootFolderName = `${feature}`;
    const featureUppercased =
      feature.charAt(0).toUpperCase() + feature.slice(1);
    await $`mkdir ${rootFolderName}`;
    within(async () => {
      cd(rootFolderName);
      await $`mkdir data di model service usecase`;
      const files = [
        `data/${featureUppercased}DataSource.ts`,
        `di/${feature}Module.test.ts`,
        `di/${feature}Module.ts`,
        `di/${feature}Types.ts`,
        `model/.gitkeep`,
        `service/${featureUppercased}Service.ts`,
        `service/Default${featureUppercased}Service.test.ts`,
        `service/Default${featureUppercased}Service.ts`,
        `usecase/.gitkeep`,
      ];
      for (const file of files) {
        await $`touch ${file}`;
      }
    });
  }
});
