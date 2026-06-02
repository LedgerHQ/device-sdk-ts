// "BOLOS" is the legacy internal name of Ledger OS, still returned by the device.
// When the current app name is Ledger OS, the device is on the dashboard (no app open).
export const LEDGER_OS_NAME = "BOLOS";

const DASHBOARD_NAMES = [LEDGER_OS_NAME, "OLOS", "OLOS\u0000"];

export const isDashboardName = (name?: string | null) =>
  name !== undefined && name !== null && DASHBOARD_NAMES.includes(name);
