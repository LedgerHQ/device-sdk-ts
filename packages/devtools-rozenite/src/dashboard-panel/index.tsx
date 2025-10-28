import { useDashboardRozeniteConnector } from "./DashboardRozeniteConnector";
import { Dashboard } from "@ledgerhq/device-management-kit-devtools-ui";

export default function RozeniteDashboard() {
  const connector = useDashboardRozeniteConnector();
  if (!connector) {
    return <h3>Connector loading...</h3>;
  }
  return <Dashboard connector={connector} />;
}
