export interface Controller {
    start(): Promise<void>;
    stop(): Promise<void>;
}
