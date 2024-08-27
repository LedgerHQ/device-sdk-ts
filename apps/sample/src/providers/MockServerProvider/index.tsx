import { createContext, useContext, useReducer } from "react";
import {
  MockServerAction,
  MockServerInitialState,
  mockServerReducer,
  MockServerState,
} from "@/reducers/mockServer";

type MockServerContextType = {
  state: MockServerState;
  dispatch: (value: MockServerAction) => void;
};

const MockServerContext = createContext<MockServerContextType>({
  state: MockServerInitialState,
  dispatch: () => null,
});

export const MockServerProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(
    mockServerReducer,
    MockServerInitialState,
  );

  return (
    <MockServerContext.Provider value={{ state, dispatch }}>
      {children}
    </MockServerContext.Provider>
  );
};

export const useMockServerContext = () =>
  useContext<MockServerContextType>(MockServerContext);
