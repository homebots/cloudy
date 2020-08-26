import * as FS from 'fs';
import * as Path from 'path';

const asyncFS = FS.promises;
const getFilePath = (...args: string[]) => Path.join(process.cwd(), ...args);

export function readFileSync(...file: string[]) {
  const buffer = FS.readFileSync(getFilePath(...file));
  return buffer.toString('utf8').trim();
}

export async function readFile(...file: string[]) {
  const buffer = await asyncFS.readFile(getFilePath(...file));
  return buffer.toString('utf8').trim();
}

export async function writeFile(...args: string[]) {
  const content = args.pop() || '';
  return await asyncFS.writeFile(getFilePath(...args), content);
}

export async function deleteFile(...args: string[]) {
  return await asyncFS.unlink(getFilePath(...args));
}

export async function exists(...file: string[]) {
  return new Promise((resolve) => FS.exists(getFilePath(...file), resolve));
}

export async function existsSync(file: string) {
  return FS.existsSync(getFilePath(file));
}

export function join(...args: string[]) {
  return getFilePath(...args);
}

export async function readDirectory(...args: string[]) {
  const path = getFilePath(...args);
  return await asyncFS.readdir(path);
}
