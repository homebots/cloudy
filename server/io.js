import * as FS from 'fs';
import * as Path from 'path';

const asyncFS = FS.promises;
const getFilePath = (...args) => Path.join(process.cwd(), ...args);

export function readFileSync(...file) {
  const buffer = FS.readFileSync(getFilePath(...file));
  return buffer.toString('utf8').trim();
}

export async function readFile(...file) {
  const buffer = await asyncFS.readFile(getFilePath(...file));
  return buffer.toString('utf8').trim();
}

export async function writeFile(...args) {
  const content = args.pop();
  return await asyncFS.writeFile(getFilePath(...args), content);
}

export async function exists(file) {
  return new Promise(resolve => FS.exists(getFilePath(file), resolve));
}

export async function existsSync(file) {
  return FS.existsSync(getFilePath(file));
}

export function join(...args) {
  return getFilePath(...args);
}

export async function readDirectory(...args) {
  const path = getFilePath(...args);
  return await asyncFS.readdir(path);
}