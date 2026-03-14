export const LogLevel = {
  Debug: 0,
  Info: 1,
  Warn: 2,
  Error: 3,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

class Logger {
  private level: LogLevel;

  constructor() {
    // Production: Warn, Dev: Debug
    this.level = import.meta.env?.DEV ? LogLevel.Debug : LogLevel.Warn;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(msg: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.Debug) console.debug(`[DEBUG] ${msg}`, ...args);
  }
  info(msg: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.Info) console.info(`[INFO] ${msg}`, ...args);
  }
  warn(msg: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.Warn) console.warn(`[WARN] ${msg}`, ...args);
  }
  error(msg: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.Error) console.error(`[ERROR] ${msg}`, ...args);
  }
}

export const logger = new Logger();
