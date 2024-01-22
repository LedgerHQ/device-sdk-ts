// Types used by the data sources (here an example for the remote data source)
// They will usually be the response of an API call that will need to be parsed
// into an object used by the application. (in our example: DTOConfig => Config)

export type ConfigDTO = {
  version: string;
  name: string;
  yolo: string;
};
