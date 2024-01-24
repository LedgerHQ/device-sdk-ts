#!/usr/bin/env zx
import "zx/globals";
import { basename } from "node:path";
const modules = argv._;

if (!modules.length) {
  console.error(`Usage: ${basename(__filename)} <feature1> [<feature2> ...]`);
  process.exit(1);
}

within(async () => {
  cd("src/internal");
  for (const mod of modules) {
    const rootFolderName = `${mod}`;
    const featureUppercased = mod.charAt(0).toUpperCase() + mod.slice(1);
    await $`mkdir ${rootFolderName}`;
    within(async () => {
      cd(rootFolderName);
      await $`mkdir data di model service usecase`;
      const files = [
        `data/${featureUppercased}DataSource.ts`,
        `di/${mod}Module.test.ts`,
        `di/${mod}Module.ts`,
        `di/${mod}Types.ts`,
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
