import { randomBytes } from 'crypto';

export function prefixedId(prefix: 'usr' | 'room' | 'msg'): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}
