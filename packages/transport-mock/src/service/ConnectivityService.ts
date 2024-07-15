import { HttpClient } from "../HttpClient";
import { Session } from "../model/Session";

export class ConnectivityService {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  async connect(sessionId: string): Promise<Session> {
    return this.client.post<Session>("connect", {}, { session_id: sessionId });
  }

  async disconnect(sessionId: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.client
        .post<undefined>("disconnect", {}, { session_id: sessionId })
        .then((_) => {
          resolve(true);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  async disconnectAll(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.client
        .get<undefined>("clear")
        .then((_) => {
          resolve(true);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  async getConnected(): Promise<Session[]> {
    return this.client.get<Session[]>("get-connected");
  }
}
