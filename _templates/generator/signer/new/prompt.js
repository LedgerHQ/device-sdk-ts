module.exports = {
  prompt: ({ inquirer }) => {
    const questions = [
      {
        type: 'input',
        name: 'cryptoName',
        message: 'What is the name of your cryptocurrency?',
        validate: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Cryptocurrency name is required';
          }
          if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(value)) {
            return 'Cryptocurrency name must start with a letter and contain only letters and numbers';
          }
          return true;
        },
      },
      {
        type: 'confirm',
        name: 'useContextModule',
        message: 'Do you want to include the context-module dependency?',
        default: false,
      },
    ];

    return inquirer.prompt(questions);
  },
};
