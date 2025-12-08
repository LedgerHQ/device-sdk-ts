import { Dashboard } from "@ledgerhq/device-management-kit-devtools-ui";
import { useRozeniteConnector } from "../shared/useRozeniteConnector";

export default function RozeniteDashboard() {
  const connector = useRozeniteConnector();
  if (!connector) {
    return <h3>Connector loading...</h3>;
  }
  return <Dashboard connector={connector} />;
}
