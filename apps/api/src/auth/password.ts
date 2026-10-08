import { createHash, randomBytes, scrypt, timingSafeEqual, type BinaryLike, type ScryptOptions } from "node:crypto";

const scryptAsync = (password: BinaryLike, salt: BinaryLike, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key)));
  });

/** OWASP-recommended scrypt cost (N=2^17, r=8, p=1) needs ~128 MiB; raise maxmem accordingly. */
const SCRYPT_N = 1 << 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SCRYPT_PREFIX = "scrypt";

function scryptHash(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return scryptAsync(password, salt, KEY_LENGTH, { N: n, r, p, maxmem: 256 * n * r });
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Format: `scrypt$N$r$p$saltHex$hashHex`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptHash(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return [SCRYPT_PREFIX, SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("hex"), hash.toString("hex")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith(`${SCRYPT_PREFIX}$`)) {
    const [, n, r, p, saltHex, hashHex] = stored.split("$");
    const N = Number(n);
    const R = Number(r);
    const P = Number(p);
    if (!saltHex || !hashHex || !Number.isInteger(N) || !Number.isInteger(R) || !Number.isInteger(P)) {
      return false;
    }
    try {
      const actual = await scryptHash(password, Buffer.from(saltHex, "hex"), N, R, P);
      return safeEqual(actual, Buffer.from(hashHex, "hex"));
    } catch {
      return false;
    }
  }

  // Legacy `salt:sha256(salt:password)` hashes from earlier releases.
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  return safeEqual(Buffer.from(actual), Buffer.from(expected));
}

/** True for hashes that should be upgraded after a successful login. */
export function needsRehash(stored: string): boolean {
  if (!stored.startsWith(`${SCRYPT_PREFIX}$`)) return true;
  const [, n, r, p] = stored.split("$");
  return Number(n) !== SCRYPT_N || Number(r) !== SCRYPT_R || Number(p) !== SCRYPT_P;
}
