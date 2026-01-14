import "zx/globals";

export const logSuccess = (message: string) => {
  console.log(chalk.green(message));
};

export const logInfo = (message: string) => {
  console.log(chalk.white(message));
};

export const logError = (message: string) => {
  console.log(chalk.red(message));
};
