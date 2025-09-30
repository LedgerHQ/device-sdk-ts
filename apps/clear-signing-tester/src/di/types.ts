export const TYPES = {
    // Repositories
    DeviceRepository: Symbol.for("DeviceRepository"),
    ScreenReader: Symbol.for("ScreenReader"),
    TransactionFileRepository: Symbol.for("TransactionFileRepository"),
    TypedDataFileRepository: Symbol.for("TypedDataFileRepository"),

    // Services
    EtherscanService: Symbol.for("EtherscanService"),
    ScreenAnalyzerService: Symbol.for("ScreenAnalyzerService"),
    ResultDisplayService: Symbol.for("ResultDisplayService"),
    Controller: Symbol.for("Controller"),
    SigningFlowOrchestrator: Symbol.for("SigningFlowOrchestrator"),
    RetryService: Symbol.for("RetryService"),

    // State Handlers
    CompleteStateHandler: Symbol.for("CompleteStateHandler"),
    ErrorStateHandler: Symbol.for("ErrorStateHandler"),
    OptOutStateHandler: Symbol.for("OptOutStateHandler"),
    SignTransactionStateHandler: Symbol.for("SignTransactionStateHandler"),

    // Use Cases
    TestTransactionUseCase: Symbol.for("TestTransactionUseCase"),
    TestBatchTransactionFromFileUseCase: Symbol.for(
        "TestBatchTransactionFromFileUseCase",
    ),
    TestTypedDataUseCase: Symbol.for("TestTypedDataUseCase"),
    TestBatchTypedDataFromFileUseCase: Symbol.for(
        "TestBatchTypedDataFromFileUseCase",
    ),

    // Adapters
    DeviceController: Symbol.for("DeviceController"),
    SpeculosSigningService: Symbol.for("SpeculosSigningService"),
    NodeFileReader: Symbol.for("NodeFileReader"),

    // Config
    DeviceConnectionConfig: Symbol.for("DeviceConnectionConfig"),
    SignerConfig: Symbol.for("SignerConfig"),
    EtherscanConfig: Symbol.for("EtherscanConfig"),

    // Logger
    LoggerPublisherServiceFactory: Symbol.for("LoggerPublisherServiceFactory"),
};
