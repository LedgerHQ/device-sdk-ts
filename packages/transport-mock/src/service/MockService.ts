import { type DefaultHttpClient } from "../DefaultHttpClient";
import { type HttpClient } from "../HttpClient";
import { type Mock } from "../model/Mock";

export class MockService {
  private client: HttpClient;

  constructor(client: DefaultHttpClient) {
    this.client = client;
  }

  async get(sessionId: string): Promise<Mock[]> {
    return this.client.get<Mock[]>("mock", { session_id: sessionId });
  }

  async add(
    sessionId: string,
    prefix: string,
    response: string,
  ): Promise<boolean> {
    return this.client.post<boolean>(
      "mock",
      { prefix, response },
      { session_id: sessionId },
    );
  }

  async delete(sessionId: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.client
        .delete<undefined>("mock", { session_id: sessionId })
        .then((_) => {
          resolve(true);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }
}
