export const TYPES = {
    // Repositories
    DeviceRepository: Symbol.for("DeviceRepository"),
    TransactionFileRepository: Symbol.for("TransactionFileRepository"),
    TypedDataFileRepository: Symbol.for("TypedDataFileRepository"),

    // Services
    EtherscanService: Symbol.for("EtherscanService"),
    ScreenAnalyzerService: Symbol.for("ScreenAnalyzerService"),
    ResultDisplayService: Symbol.for("ResultDisplayService"),
    SigningService: Symbol.for("SigningService"),
    SigningFlowOrchestrator: Symbol.for("SigningFlowOrchestrator"),
    RetryService: Symbol.for("RetryService"),

    // State Handlers
    CompleteStateHandler: Symbol.for("CompleteStateHandler"),
    ErrorStateHandler: Symbol.for("ErrorStateHandler"),
    OptOutStateHandler: Symbol.for("OptOutStateHandler"),
    SignTransactionStateHandler: Symbol.for("SignTransactionStateHandler"),

    // Service Controllers
    MainServiceController: Symbol.for("MainServiceController"),
    DMKServiceController: Symbol.for("DMKServiceController"),
    SpeculosServiceController: Symbol.for("SpeculosServiceController"),

    // Adapters
    ScreenReader: Symbol.for("ScreenReader"),
    NodeFileReader: Symbol.for("NodeFileReader"),
    DockerContainer: Symbol.for("DockerContainer"),
    Downloader: Symbol.for("Downloader"),

    // Device Controllers and Metadata
    DeviceController: Symbol.for("DeviceController"),
    DeviceMetadata: Symbol.for("DeviceMetadata"),

    // Use Cases
    TestTransactionUseCase: Symbol.for("TestTransactionUseCase"),
    TestBatchTransactionFromFileUseCase: Symbol.for(
        "TestBatchTransactionFromFileUseCase",
    ),
    TestTypedDataUseCase: Symbol.for("TestTypedDataUseCase"),
    TestBatchTypedDataFromFileUseCase: Symbol.for(
        "TestBatchTypedDataFromFileUseCase",
    ),

    // Config
    SpeculosConfig: Symbol.for("SpeculosConfig"),
    SignerConfig: Symbol.for("SignerConfig"),
    EtherscanConfig: Symbol.for("EtherscanConfig"),

    // Logger
    LoggerPublisherServiceFactory: Symbol.for("LoggerPublisherServiceFactory"),
};
