import {
    randomBytes,
    scrypt,
    timingSafeEqual,
} from "node:crypto";

const HASH_VERSION = "scrypt-v1";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

const SCRYPT_OPTIONS = {
    N: 2 ** 15,
    r: 8,
    p: 3,
    maxmem: 64 * 1024 * 1024,
};

function deriveKey(
    password: string,
    salt: Buffer,
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scrypt(
            password,
            salt,
            KEY_LENGTH,
            SCRYPT_OPTIONS,
            (error, derivedKey) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(derivedKey);
            },
        );
    });
}

export async function hashPassword(
    password: string,
): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);

    const derivedKey = await deriveKey(
        password,
        salt,
    );

    return [
        HASH_VERSION,
        salt.toString("hex"),
        derivedKey.toString("hex"),
    ].join("$");
}

export async function verifyPassword(
    password: string,
    storedPasswordHash: string,
): Promise<boolean> {
    const parts =
        storedPasswordHash.split("$");

    if (parts.length !== 3) {
        return false;
    }

    const [
        version,
        saltHex,
        derivedKeyHex,
    ] = parts;

    if (
        version !== HASH_VERSION ||
        !saltHex ||
        !derivedKeyHex
    ) {
        return false;
    }

    let salt: Buffer;
    let storedDerivedKey: Buffer;

    try {
        salt = Buffer.from(saltHex, "hex");

        storedDerivedKey = Buffer.from(
            derivedKeyHex,
            "hex",
        );
    } catch {
        return false;
    }

    if (
        salt.length !== SALT_LENGTH ||
        storedDerivedKey.length !== KEY_LENGTH
    ) {
        return false;
    }

    const suppliedDerivedKey =
        await deriveKey(password, salt);

    return timingSafeEqual(
        suppliedDerivedKey,
        storedDerivedKey,
    );
}