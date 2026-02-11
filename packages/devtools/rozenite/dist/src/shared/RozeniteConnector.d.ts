import { Connector } from '@ledgerhq/device-management-kit-devtools-core';
import { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { PluginEvents } from './PluginEvents';
export declare class RozeniteConnector implements Connector {
    /**
     * STATIC METHODS
     */
    static instance: RozeniteConnector | null;
    static getInstance(): RozeniteConnector;
    static destroyInstance(): void;
    /**
     * INSTANCE METHODS
     */
    private rozeniteClient;
    private messagesToSend;
    private messagesFromDashboard;
    private messagesToSendSubscription;
    private constructor();
    setClient(rozeniteClient: RozeniteDevToolsClient<PluginEvents>): void;
    private destroy;
    private initialize;
    sendMessage(type: string, payload: string): void;
    listenToMessages(listener: (type: string, payload: string) => void): {
        unsubscribe: () => void;
    };
}
