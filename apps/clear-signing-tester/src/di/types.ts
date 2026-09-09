export const TYPES = {
  // Repositories
  DeviceRepository: Symbol.for("DeviceRepository"),
  TransactionFileRepository: Symbol.for("TransactionFileRepository"),
  TypedDataFileRepository: Symbol.for("TypedDataFileRepository"),
  ContactsRepository: Symbol.for("ContactsRepository"),
  SpeculosContactsRepository: Symbol.for("SpeculosContactsRepository"),
  ContactFileRepository: Symbol.for("ContactFileRepository"),

  // Services
  TransactionCrafter: Symbol.for("TransactionCrafter"),
  ScreenAnalyzerService: Symbol.for("ScreenAnalyzerService"),
  SigningService: Symbol.for("SigningService"),
  SigningFlowOrchestrator: Symbol.for("SigningFlowOrchestrator"),
  SignableInteractions: Symbol.for("SignableInteractions"),
  RetryService: Symbol.for("RetryService"),
  DeviceSetupService: Symbol.for("DeviceSetupService"),
  TransactionCraftingService: Symbol.for("TransactionCraftingService"),

  // State Handlers
  CompleteStateHandler: Symbol.for("CompleteStateHandler"),
  ErrorStateHandler: Symbol.for("ErrorStateHandler"),
  OptOutStateHandler: Symbol.for("OptOutStateHandler"),
  SignTransactionStateHandler: Symbol.for("SignTransactionStateHandler"),

  // Service Controllers
  MainServiceController: Symbol.for("MainServiceController"),
  DMKServiceController: Symbol.for("DMKServiceController"),
  SolanaDMKServiceController: Symbol.for("SolanaDMKServiceController"),
  SpeculinhoServiceController: Symbol.for("SpeculinhoServiceController"),
  ServiceControllers: Symbol.for("ServiceControllers"),

  // Adapters
  ScreenReader: Symbol.for("ScreenReader"),
  ScreenshotSaver: Symbol.for("ScreenshotSaver"),
  FileReader: Symbol.for("FileReader"),
  JsonParser: Symbol.for("JsonParser"),
  CalAdapter: Symbol.for("CalAdapter"),

  // Device Controllers
  DeviceController: Symbol.for("DeviceController"),

  // Use Cases
  TestBatchTransactionFromFileUseCase: Symbol.for(
    "TestBatchTransactionFromFileUseCase",
  ),
  TestBatchTypedDataFromFileUseCase: Symbol.for(
    "TestBatchTypedDataFromFileUseCase",
  ),
  TestContactUseCase: Symbol.for("TestContactUseCase"),
  TestBatchContactFromFileUseCase: Symbol.for(
    "TestBatchContactFromFileUseCase",
  ),
  TestSolanaTransactionUseCase: Symbol.for("TestSolanaTransactionUseCase"),
  TestBatchSolanaTransactionFromFileUseCase: Symbol.for(
    "TestBatchSolanaTransactionFromFileUseCase",
  ),

  // Solana program-level testing (fetches transactions by program ID via RPC)
  SolanaRpcAdapter: Symbol.for("SolanaRpcAdapter"),
  SolanaTransactionProgramRepository: Symbol.for(
    "SolanaTransactionProgramRepository",
  ),
  TestSolanaProgramUseCase: Symbol.for("TestSolanaProgramUseCase"),

  // Config
  SpeculinhoConfig: Symbol.for("SpeculinhoConfig"),
  SignerConfig: Symbol.for("SignerConfig"),
  SolanaRpcConfig: Symbol.for("SolanaRpcConfig"),
  CalConfig: Symbol.for("CalConfig"),

  // Logger
  LoggerPublisherServiceFactory: Symbol.for("LoggerPublisherServiceFactory"),
  LoggerSubscribers: Symbol.for("LoggerSubscribers"),
  LogLevel: Symbol.for("LogLevel"),
};
