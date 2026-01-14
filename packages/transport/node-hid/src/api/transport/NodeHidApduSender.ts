import { 
    ApduReceiverService,
    ApduReceiverServiceFactory,
    ApduResponse,
    ApduSenderService,
    ApduSenderServiceFactory, 
    DeviceApduSender, 
    DmkError, 
    formatApduReceivedLog, 
    formatApduSentLog, 
    FramerUtils, 
    LoggerPublisherService, 
    OpeningConnectionError, 
    SendApduResult, 
    SendApduTimeoutError
} from "@ledgerhq/device-management-kit";
import { HIDAsync, type Device as NodeHIDDevice } from "node-hid";
import * as Sentry from "@sentry/minimal";
import { Either, Left, Maybe, Nothing, Right } from "purify-ts";
import { NodeHidSendReportError } from "@api/model/Errors";
import { FRAME_SIZE } from "@api/data/NodeHidConfig";


export type NodeHidApduSenderDependencies = {
    device: NodeHIDDevice ;
}

export type NodeHidApduSenderConstructorArgs = {
    dependencies: NodeHidApduSenderDependencies,
    apduSenderFactory: ApduSenderServiceFactory,
    apduReceiverFactory: ApduReceiverServiceFactory,
    loggerFactory: (tag: string) => LoggerPublisherService
}

export class NodeHidApduSender implements DeviceApduSender<NodeHidApduSenderDependencies> {

    private dependencies: NodeHidApduSenderDependencies;
    private readonly apduSenderFactory: ApduSenderServiceFactory;
    private apduSender: ApduSenderService;
    private readonly apduReceiverFactory: ApduReceiverServiceFactory;
    private apduReceiver: ApduReceiverService;
    private readonly logger: LoggerPublisherService;
    private hidAsync: HIDAsync | null;
    private sendApduPromiseResolver: Maybe<(value: Either<DmkError, ApduResponse>) => void>;
   // private abortTimeout: Maybe<ReturnType<typeof setTimeout>>;
    
    constructor({
        dependencies,
        apduSenderFactory,
        apduReceiverFactory,
        loggerFactory
    } : NodeHidApduSenderConstructorArgs) {
        const channel = Maybe.of(
            FramerUtils.numberToByteArray(Math.floor(Math.random() * 0xffff), 2),
          );
        this.dependencies = dependencies;
        this.apduSenderFactory = apduSenderFactory;
        this.apduSender = this.apduSenderFactory({
            frameSize: FRAME_SIZE,
            channel,
            padding: true,
          });
        this.apduReceiverFactory = apduReceiverFactory;
        this.apduReceiver = this.apduReceiverFactory({ channel });
        this.logger = loggerFactory("NodeHidApduSender");
        this.hidAsync = null;
        this.sendApduPromiseResolver = Nothing;
        //this.abortTimeout = Nothing;
    }

    public async sendApdu(
        apdu: Uint8Array, 
        _triggersDisconnection?: boolean, 
        abortTimeout?: number
    ) : Promise<SendApduResult> {

        let timeout: ReturnType<typeof setTimeout> | undefined;

        if (null === this.hidAsync) {
            this.sendApduPromiseResolver = Nothing;
            return Promise.resolve(Left(new OpeningConnectionError("Device not connected")));
        }


        const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
        (resolve) => {
            this.sendApduPromiseResolver = Maybe.of((...args) => {
            if (timeout) {
                clearTimeout(timeout);
            }
            return resolve(...args);
            });
        });
       
        this.logger.debug(formatApduSentLog(apdu));

        for (const frame of this.apduSender.getFrames(apdu)) {
            try {
                const report = Buffer.from([0x00].concat([...frame.getRawData()]));
                await this.hidAsync.write(report);
            } catch (error) {
                this.logger.info("Error sending frame", { data: { error } });
                return Promise.resolve(Left(new NodeHidSendReportError(error)));
            }
        }

        if (abortTimeout) {
            timeout = setTimeout(() => {
                this.logger.debug("[sendApdu] Abort timeout", {
                    data: { abortTimeout },
                });
                this.sendApduPromiseResolver.map((resolve) =>
                    resolve(Left(new SendApduTimeoutError("Abort timeout"))),
                );
            }, abortTimeout)
        }   

        return resultPromise;
    };

    public getDependencies() : NodeHidApduSenderDependencies {
        return this.dependencies;
    };

    public setDependencies(dependencies: NodeHidApduSenderDependencies) : void {
        this.dependencies = dependencies;
    }
    
    public async setupConnection() : Promise<void> {
        try {

            if (null !== this.hidAsync) {
                await this.hidAsync.close();
                this.hidAsync = null;
                this.sendApduPromiseResolver = Nothing;
                //this.abortTimeout = Nothing;
            }

            // Create a new channel shared between sender AND receiver
            const channel = Maybe.of(
                FramerUtils.numberToByteArray(Math.floor(Math.random() * 0xffff), 2),
            );
            this.apduSender = this.apduSenderFactory({
                frameSize: FRAME_SIZE,
                channel,
                padding: true,
            });
            
            this.apduReceiver = this.apduReceiverFactory({ channel });
            
            if (undefined === this.dependencies.device.path) {
                throw new Error("Missing device path");
            }
            
            this.hidAsync = await HIDAsync.open(this.dependencies.device.path, {nonExclusive: true});
            this.hidAsync.on("data", (data: Buffer) => this.receiveHidInputReport(data));
            this.hidAsync.on("error", (error) => {
                this.logger.error("Error while receiving data", { data: { error }});
                this.sendApduPromiseResolver.map((resolve) => resolve(Left(new NodeHidSendReportError(error))));
            });
            this.logger.info("🔌 Connected to device");
        } catch (error) {
            this.logger.error(`Error while opening device`, { data: { error } });
            Sentry.captureException(new OpeningConnectionError(error));
            throw error;
        }
    }
    
    public async closeConnection() : Promise<void> {
        if (null === this.hidAsync) {
            return;
        }

        try {
            await this.hidAsync.close();

            this.hidAsync = null;
            this.sendApduPromiseResolver = Nothing;
            //this.abortTimeout = Nothing;
            this.logger.info("🔚 Disconnect");

        } catch (error) {
            this.logger.error("Error while closing device", {
                data: { device: this.dependencies.device, error },
            });
        }
    }
    
    private receiveHidInputReport(buffer: Buffer) {
        const data = new Uint8Array(buffer)
        const maybeApduResponse = this.apduReceiver.handleFrame(data);

        maybeApduResponse.map((response) => {
            response.map((apduResponse) => {
                this.logger.debug(formatApduReceivedLog(apduResponse));
                this.sendApduPromiseResolver.map((resolve) => resolve(Right(apduResponse)));
            });
        })
        .mapLeft((error) => {
            this.sendApduPromiseResolver.map((resolve) => resolve(Left(error)));
        });
    }
    
    /* private resolvePendingApdu(result: Either<DmkError, ApduResponse>): void {
        this.abortTimeout
        .map((timeout) => {
            clearTimeout(timeout);
            this.abortTimeout = Nothing;
        });
        this.sendApduPromiseResolver
        .map((resolve) => {
            resolve(result);
            this.sendApduPromiseResolver = Nothing;
        });
    } */
}