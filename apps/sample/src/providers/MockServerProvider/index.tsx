import { createContext, useContext, useReducer } from "react";
import {
  MockServerAction,
  MockServerInitialState,
  mockServerReducer,
  MockServerState,
} from "@/reducers/mockServer";
import { IsDefaultMockEnabled } from "@/utils/constants";

type MockServerContextType = {
  state: MockServerState;
  dispatch: (value: MockServerAction) => void;
};

const MockServerContext = createContext<MockServerContextType>({
  state: MockServerInitialState(
    process.env.MOCK_SERVER_DEFAULT_ENABLED as IsDefaultMockEnabled,
  ),
  dispatch: () => null,
});

export const MockServerProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(
    mockServerReducer,
    MockServerInitialState(
      process.env.MOCK_SERVER_DEFAULT_ENABLED as IsDefaultMockEnabled,
    ),
  );

  return (
    <MockServerContext.Provider value={{ state, dispatch }}>
      {children}
    </MockServerContext.Provider>
  );
};

export const useMockServerContext = () =>
  useContext<MockServerContextType>(MockServerContext);
