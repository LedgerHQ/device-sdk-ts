export type Message = {
  type: string;
  payload: string;
};

export interface PluginEvents extends Record<string, unknown> {
  init: string;
  message: Message;
}
