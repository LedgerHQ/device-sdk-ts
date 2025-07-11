const DASHBOARD_NAMES = ["BOLOS", "OLOS", "OLOS\u0000"];

export const isDashboardName = (name: string) => DASHBOARD_NAMES.includes(name);
