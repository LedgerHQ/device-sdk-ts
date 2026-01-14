import "zx/globals";
import { logInfo } from "../utils";
import { useDmk } from "../services";

export type ListenForDmkCommand = () => Promise<void>;

export const handleVersion = async (listenForDmkCommand: ListenForDmkCommand): Promise<void> => {
  const version = await useDmk().getVersion();
  logInfo(`\nDMK version: v${version}\n`);
  return listenForDmkCommand();
};
