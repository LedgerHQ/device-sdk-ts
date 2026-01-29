export interface Connector {
  sendMessage: (type: string, payload: string) => void;
  listenToMessages: (listener: (type: string, payload: string) => void) => {
    unsubscribe: () => void;
  };
}
