import { request } from 'http';

const toJson = (x) => JSON.stringify(x);
const logOutput = process.env.LOG_OUTPUT || 'console';

export const serializeError = (error) => (error && error instanceof Error) ? error.stack : String(error);

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
          `[${new Date().toISOString().slice(0, 10)}]`,
          type,
          this.name,
          JSON.stringify(logEntry, null, 2),
        );
    }
  }
}