import "zx/globals";
import { logInfo } from "../utils";
import { useDmk } from "../services";
import { ListenForCommand } from "../utils/Constants";

export const handleVersion = async (listenForCommand: ListenForCommand): Promise<void> => {
  const version = await useDmk().getVersion();
  logInfo(`\nDMK version: v${version}\n`);
  return listenForCommand();
};
