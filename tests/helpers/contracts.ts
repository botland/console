import fs from 'fs';
import path from 'path';

export function contractsRoot(): string {
  return path.resolve(__dirname, '../../..', 'tests', 'contracts');
}

export function loadContract<T>(name: string): T {
  const file = path.join(contractsRoot(), name);
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}