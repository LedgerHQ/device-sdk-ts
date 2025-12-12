export const TYPES = {
  // Repositories
  DeviceRepository: Symbol.for("DeviceRepository"),
  TransactionFileRepository: Symbol.for("TransactionFileRepository"),
  TypedDataFileRepository: Symbol.for("TypedDataFileRepository"),
  ContractFileRepository: Symbol.for("ContractFileRepository"),
  TransactionContractRepository: Symbol.for("TransactionContractRepository"),

  // Services
  EtherscanAdapter: Symbol.for("EtherscanAdapter"),
  TransactionCrafter: Symbol.for("TransactionCrafter"),
  ScreenAnalyzerService: Symbol.for("ScreenAnalyzerService"),
  SigningService: Symbol.for("SigningService"),
  SigningFlowOrchestrator: Symbol.for("SigningFlowOrchestrator"),
  RetryService: Symbol.for("RetryService"),
  AppVersionResolver: Symbol.for("AppVersionResolver"),

  // State Handlers
  CompleteStateHandler: Symbol.for("CompleteStateHandler"),
  ErrorStateHandler: Symbol.for("ErrorStateHandler"),
  OptOutStateHandler: Symbol.for("OptOutStateHandler"),
  SignTransactionStateHandler: Symbol.for("SignTransactionStateHandler"),

  // Service Controllers
  MainServiceController: Symbol.for("MainServiceController"),
  DMKServiceController: Symbol.for("DMKServiceController"),
  SpeculosServiceController: Symbol.for("SpeculosServiceController"),
  ServiceControllers: Symbol.for("ServiceControllers"),

  // Adapters
  ScreenReader: Symbol.for("ScreenReader"),
  ScreenshotSaver: Symbol.for("ScreenshotSaver"),
  FileReader: Symbol.for("FileReader"),
  JsonParser: Symbol.for("JsonParser"),
  DockerContainer: Symbol.for("DockerContainer"),
  CalAdapter: Symbol.for("CalAdapter"),

  // Device Controllers
  DeviceController: Symbol.for("DeviceController"),

  // Use Cases
  TestTransactionUseCase: Symbol.for("TestTransactionUseCase"),
  TestBatchTransactionFromFileUseCase: Symbol.for(
    "TestBatchTransactionFromFileUseCase",
  ),
  TestTypedDataUseCase: Symbol.for("TestTypedDataUseCase"),
  TestBatchTypedDataFromFileUseCase: Symbol.for(
    "TestBatchTypedDataFromFileUseCase",
  ),
  TestContractUseCase: Symbol.for("TestContractUseCase"),
  TestBatchContractFromFileUseCase: Symbol.for(
    "TestBatchContractFromFileUseCase",
  ),

  // Config
  SpeculosConfig: Symbol.for("SpeculosConfig"),
  SignerConfig: Symbol.for("SignerConfig"),
  EtherscanConfig: Symbol.for("EtherscanConfig"),
  AppsConfig: Symbol.for("AppsConfig"),

  // Logger
  LoggerPublisherServiceFactory: Symbol.for("LoggerPublisherServiceFactory"),
  LoggerSubscribers: Symbol.for("LoggerSubscribers"),
};
