const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

export function log(message: string): void {
  console.log(message);
}

export function success(message: string): void {
  console.log(`${COLORS.green}✓${COLORS.reset} ${message}`);
}

export function error(message: string): void {
  console.error(`${COLORS.red}✗${COLORS.reset} ${message}`);
}

export function warn(message: string): void {
  console.warn(`${COLORS.yellow}⚠${COLORS.reset} ${message}`);
}

export function info(message: string): void {
  console.log(`${COLORS.blue}ℹ${COLORS.reset} ${message}`);
}

export function highlight(message: string): string {
  return `${COLORS.bold}${message}${COLORS.reset}`;
}

export function dim(message: string): string {
  return `${COLORS.gray}${message}${COLORS.reset}`;
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
    case "error":
      return COLORS.red;
    case "warning":
      return COLORS.yellow;
    case "info":
      return COLORS.blue;
    case "suggestion":
      return COLORS.cyan;
    default:
      return COLORS.reset;
  }
}
