import { describe, it, expect, beforeEach } from '@jest/globals'
import { createActor } from 'xstate';
import makeOpenAppMachine, { APP_NOT_FOUND_ERROR, DEVICE_NOT_ONBOARDED_ERROR, OPEN_REJECTED_ERROR, LOCKED_DEVICE_ERROR} from "./openAppStateMachine";

jest.useFakeTimers()

describe("openAppStateMachine", () => {
  const mockedGetAppAndVersion = jest.fn();
  const mockedCloseApp = jest.fn();
  const mockedOpenApp = jest.fn();
  
  const openAppMachine = makeOpenAppMachine(
    {
      getAppAndVersion: mockedGetAppAndVersion,
      closeApp: mockedCloseApp,
      openApp: mockedOpenApp,
    }
  );

  beforeEach(() => {
    jest.clearAllMocks();
  })

  it("should end in an error if the device is not onboarded", (done) => {
    const openAppMachineActor = createActor(openAppMachine, {
      input: {
        requestedAppName: "Bitcoin",
        deviceSessionState: {
          status: "Ready",
          deviceOnboarded: false,
        },
      },
    });

    openAppMachineActor.subscribe((state) => {
      try {
        if (state.status === "done") {
          expect(state.value).toEqual("Error");
          if ("error" in state.output) {
            expect(state.output.error).toBeDefined();
            expect(state.output.error.message).toEqual(DEVICE_NOT_ONBOARDED_ERROR);
            done()
          } else {
            done("Expected error in output")
          }
        }
      } catch(e: any) {
        done(e.message)
      }
    });

    openAppMachineActor.start();

  })

  it("should end in an error if the device is locked", (done) => {
      const openAppMachineActor = createActor(openAppMachine, {
        input: {
          requestedAppName: "Bitcoin",
          deviceSessionState: {
            status: "Locked",
            deviceOnboarded: true,
          },
        },
      });
  
      openAppMachineActor.subscribe((state) => {
        try {
          if (state.status === "done") {
            expect(state.value).toEqual("Error");
            if ("error" in state.output) {
              expect(state.output.error).toBeDefined();
              expect(state.output.error.message).toEqual(LOCKED_DEVICE_ERROR);
              done()
            } else {
              done("Expected error in output")
            }
          }
        } catch(e: any) {
          done(e.message)
        }
      });

      openAppMachineActor.start();
  });

  it("should end in an error if getAppAndVersion throws an error", (done) => {
    const mockedErrorMessage = "Mocked error";

    // getAppAndVersion throws an error
    mockedGetAppAndVersion.mockRejectedValue(new Error(mockedErrorMessage));

    const openAppMachineActor = createActor(openAppMachine, {
      input: {
        requestedAppName: "Bitcoin",
        deviceSessionState: {
          status: "Ready",
          deviceOnboarded: true,
        },
      },
    });

    openAppMachineActor.subscribe((state) => {
      try {
        if (state.status === "done") {
          expect(state.value).toEqual("Error");
          if ("error" in state.output) {
            expect(state.output.error).toBeDefined();
            expect(state.output.error.message).toEqual("Mocked error");
            done()
          } else {
            done("Expected error in output")
          }
        }
      } catch(e: any) {
        done(e.message)
      }
    });

    openAppMachineActor.start();
  });

  it("should end in a success if the app is already opened", (done) => {

    // App already opened
    mockedGetAppAndVersion.mockResolvedValue({app: "Bitcoin", version: "1.0.0"});

    const openAppMachineActor = createActor(openAppMachine, {
      input: {
        requestedAppName: "Bitcoin",
        deviceSessionState: {
          status: "Ready",
          deviceOnboarded: true,
        },
      },
    });

    openAppMachineActor.subscribe((state) => {
      try {
        if (state.status === "done") {
          expect(state.value).toEqual("Success");
          if ("currentlyRunningApp" in state.output) {
            expect(state.output).toBeDefined();
            expect(state.output.currentlyRunningApp).toEqual("Bitcoin");
            done()
          } else {
            done("Expected currentlyRunningApp in state")
          }
        }
      } catch(e: any) {
        done(e.message)
      }
    });

    openAppMachineActor.start();
  });

  it("should end in a success if the dashboard is open and open app succeeds", (done) => {

    // Dashboard is open
    mockedGetAppAndVersion.mockResolvedValue({app: "Dashboard", version: "1.0.0"});
    // Open app succeeds
    mockedOpenApp.mockResolvedValue(undefined);

    const openAppMachineActor = createActor(openAppMachine, {
      input: {
        requestedAppName: "Bitcoin",
        deviceSessionState: {
          status: "Ready",
          deviceOnboarded: true,
        },
      },
    });

    openAppMachineActor.subscribe((state) => {
      try {
        if (state.status === "done") {
          expect(state.value).toEqual("Success");
          if ("currentlyRunningApp" in state.output) {
            expect(state.output).toBeDefined();
            expect(state.output.currentlyRunningApp).toEqual("Bitcoin");
            done()
          } else {
            done("Expected currentlyRunningApp in state")
          }
        }
      } catch(e: any) {
        done(e.message)
      }
    });

    openAppMachineActor.start();

  });

  it("should end in an error if the dashboard is open and open app throws an error", (done) => {

    // Dashboard is open
    mockedGetAppAndVersion.mockResolvedValue({app: "Dashboard", version: "1.0.0"});
    // Open app throws an error
    mockedOpenApp.mockRejectedValue(new Error("Mocked error"));

    const openAppMachineActor = createActor(openAppMachine, {
      input: {
        requestedAppName: "Bitcoin",
        deviceSessionState: {
          status: "Ready",
          deviceOnboarded: true,
        },
      },
    });

    openAppMachineActor.subscribe((state) => {
      try {
        if (state.status === "done") {
          expect(state.value).toEqual("Error");
          if ("error" in state.output) {
            expect(state.output.error).toBeDefined();
            expect(state.output.error.message).toEqual("Mocked error");
            done()
          } else {
            done("Expected error in output")
          }
        }
      } catch(e: any) {
        done(e.message)
      }
    });

    openAppMachineActor.start();
  });

  it("should end in an error if another app is open, and close app throws", (done) => {
      
      // Another app is open
      mockedGetAppAndVersion.mockResolvedValue({app: "Ethereum", version: "1.0.0"});
      // Close app throws an error
      mockedCloseApp.mockRejectedValue(new Error("Mocked error"));
  
      const openAppMachineActor = createActor(openAppMachine, {
        input: {
          requestedAppName: "Bitcoin",
          deviceSessionState: {
            status: "Ready",
            deviceOnboarded: true,
          },
        },
      });
  
      openAppMachineActor.subscribe((state) => {
        try {
          if (state.status === "done") {
            expect(state.value).toEqual("Error");
            if ("error" in state.output) {
              expect(state.output.error).toBeDefined();
              expect(state.output.error.message).toEqual("Mocked error");
              done()
            } else {
              done("Expected error in output")
            }
          }
        } catch(e: any) {
          done(e.message)
        }
      });
  
      openAppMachineActor.start();
  });

  it("should end in an error if another app is open, close app succeeds but open app throws", (done) => {
        
      // Another app is open
      mockedGetAppAndVersion.mockResolvedValue({app: "Ethereum", version: "1.0.0"});
      // Close app succeeds
      mockedCloseApp.mockResolvedValue(undefined);
      // Open app throws an error
      mockedOpenApp.mockRejectedValue(new Error("Mocked error"));
  
      const openAppMachineActor = createActor(openAppMachine, {
        input: {
          requestedAppName: "Bitcoin",
          deviceSessionState: {
            status: "Ready",
            deviceOnboarded: true,
          },
        },
      });
  
      openAppMachineActor.subscribe((state) => {
        try {
          if (state.status === "done") {
            expect(state.value).toEqual("Error");
            if ("error" in state.output) {
              expect(state.output.error).toBeDefined();
              expect(state.output.error.message).toEqual("Mocked error");
              done()
            } else {
              done("Expected error in output")
            }
          }
        } catch(e: any) {
          done(e.message)
        }
      });
  
      openAppMachineActor.start();
  });

  it("should end in a success if another app is open, close app succeeds and open app succeeds", (done) => {
            
        // Another app is open
        mockedGetAppAndVersion.mockResolvedValue({app: "Ethereum", version: "1.0.0"});
        // Close app succeeds
        mockedCloseApp.mockResolvedValue(undefined);
        // Open app succeeds
        mockedOpenApp.mockResolvedValue(undefined);
    
        const openAppMachineActor = createActor(openAppMachine, {
          input: {
            requestedAppName: "Bitcoin",
            deviceSessionState: {
              status: "Ready",
              deviceOnboarded: true,
            },
          },
        });
    
        openAppMachineActor.subscribe((state) => {
          try {
            if (state.status === "done") {
              expect(state.value).toEqual("Success");
              if ("currentlyRunningApp" in state.output) {
                expect(state.output).toBeDefined();
                expect(state.output.currentlyRunningApp).toEqual("Bitcoin");
                done()
              } else {
                done("Expected currentlyRunningApp in state")
              }
            }
          } catch(e: any) {
            done(e.message)
          }
        });
    
        openAppMachineActor.start();
  });

})