import { spawnSync } from 'child_process';
import { Log } from './log.js';

const shOptions = { stdio: 'pipe', shell: true };
const logger = Log.create('shell');

const logPrefix = (string) => string.trim().split('\n').filter(Boolean).map(line => `>> ${line}`).join('\n');

export class Shell {
  static execAndLog(command, args) {
    logger.log(command + ' ' + args.join(' '));

    try {
      const output = Shell.exec(command, args);

      if (output) {
        logger.log(logPrefix(output));
      }

      return output;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static exec(command, args) {
    const commandOutput = spawnSync(command, args, shOptions)

    if (commandOutput.error || Number(commandOutput.status) !== 0) {
      throw new Error(`Command ${command} failed with code ${commandOutput.status}:\n${commandOutput.stderr.toString()}`);
    }

    return commandOutput.stdout.toString('utf8').trim();
  }
}