// Types used by the data sources (here an example for the remote data source)
// They will usually be the response of an API call that will need to be parsed
// into an object used by the application. (in our example: ConfigDto => Config)

export type ConfigDto = {
  version: string;
  name: string;
  yolo: string;
};
