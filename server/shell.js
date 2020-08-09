import { spawnSync } from 'child_process';
import { Log } from './log.js';

const shOptions = { stdio: 'pipe', shell: true };
const logger = Log.create('shell');

const logPrefix = (string) => string.trim().split('\n').filter(Boolean).map(line => `>> ${line}`).join('\n');

export class Shell {
  static execAndLog(command, args) {
    logger.log(command + ' ' + args.join(' '));
    const output = Shell.exec(command, args);

    logger.log(logPrefix(output));

    return output.trim();
  }

  static exec(command, args) {
    const commandOutput = spawnSync(command, args, shOptions)

    if (commandOutput.error) {
      throw commandOutput.error;
    }

    return commandOutput.stdout.toString('utf8');
  }

  static exec2(command, args) {
    logger.log(command + ' ' + args.join(' '));
  }
}