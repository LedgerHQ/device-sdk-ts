export interface ServiceController {
  start(): Promise<void>;
  stop(): Promise<void>;
}
