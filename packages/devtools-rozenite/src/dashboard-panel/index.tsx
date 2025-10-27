import { useDashboardRozeniteConnector } from "./DashboardRozeniteConnector";
import Dashboard from "../devtools-ui/Dashboard";

export default function RozeniteDashboard() {
  const connector = useDashboardRozeniteConnector();
  if (!connector) {
    return <h3>Connector loading...</h3>;
  }
  return <Dashboard connector={connector} />;
}
