import "zx/globals";

import { appModule } from "@ldmk/app/di/app.module";
import { appTypes } from "@ldmk/app/di/app.types";
import { type FrontController } from "@ldmk/app/FrontController";
import { Container } from "inversify";

const bootstrap = async (): Promise<Container> => {
  const container = new Container();
  await container.load(appModule);
  return container;
};

async function main(): Promise<void> {
  const container = await bootstrap();
  const frontController = container.get<FrontController>(
    appTypes.FrontController,
  );
  await frontController.run();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
