const toJson = (x, oneLine = false) => JSON.stringify(x, null, oneLine ? 0 : 2);
const logOutput = process.env.LOG_OUTPUT || 'console';

export const serializeError = (error) => (error && error instanceof Error) ? error.stack : String(error);
const timestamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
export class Log {
  static create(name) {
    return new Log(name);
  }

  constructor(name) {
    this.name = name;
  }

  log(...args) {
    const content = this.getContent(...args);
    this.write('info', content);
  }

  warn(...args) {
    const content = this.getContent(...args);
    this.write('warning', content);
  }

  error(...args) {
    const content = this.getContent(...args);
    this.write('error', content);
  }

  debug(...args) {
    const content = this.getContent(...args);
    this.write('debug', content);
  }

  getContent(...args) {
    args = args.map(arg => arg && arg instanceof Error ? arg.message : arg);

    if (args.length === 1) {
      const content = typeof args[0] !== 'object' ? { message: args[0] } : args[0];
      return { content }
    }

    return { content: args };
  }

  write(type, logEntry)  {
    switch(logOutput) {
      case 'http':
        // http.push(toJson({
        //   type,
        //   time: Date.now(),
        //   from: this.name,
        //   ...logEntry
        // }));
        break;

      case 'console':
      default:
        console.log(
          `[${type}]`,
          timestamp(),
          this.name,
          toJson(logEntry.content.message || logEntry.content, true),
        );
    }
  }
}