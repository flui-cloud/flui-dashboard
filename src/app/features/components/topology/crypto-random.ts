export function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 0x1_0000_0000;
}

export function cryptoRandomInt(maxExclusive: number): number {
  return Math.trunc(cryptoRandom() * maxExclusive);
}
