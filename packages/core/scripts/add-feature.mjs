#!/usr/bin/env zx
import { basename } from 'path';

const features = argv._;

if (!features.length) {
  await console.error(`Usage: ${basename(__filename)} <feature1> [<feature2> ...]`);
  process.exit(1);
}

within(async () => {
  cd('src');
  for (const feature of features) {
    const rootFolderName = `${feature}-feature`;
    await $`mkdir ${rootFolderName}`;
    within(async () => {
      cd(rootFolderName);
      await $`mkdir entities data use-cases repository`;
      await $`touch entities/.gitkeep data/.gitkeep use-cases/.gitkeep repository/.gitkeep`;
    })
  }
})
