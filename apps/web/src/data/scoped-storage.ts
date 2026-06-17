import { scopedKey } from "./storage-scope";

function legacyPrefixedKey(baseKey: string): string {
    return `specora:${baseKey}`;
}

export function readScopedItem(key: string, legacyKey?: string): string | null {
    try {
        const scoped = scopedKey(key);
        const value = localStorage.getItem(scoped);
        if (value !== null) {
            return value;
        }

        for (const candidate of [legacyKey, legacyPrefixedKey(key)].filter(Boolean)) {
            const legacy = localStorage.getItem(candidate!);
            if (legacy !== null) {
                localStorage.setItem(scoped, legacy);
                return legacy;
            }
        }

        return null;
    } catch {
        return null;
    }
}

export function writeScopedItem(key: string, value: string): boolean {
    try {
        localStorage.setItem(scopedKey(key), value);
        return true;
    } catch {
        return false;
    }
}

export function readScopedJson<T>(key: string, fallback: T, legacyKey?: string): T {
    try {
        const raw = readScopedItem(key, legacyKey);
        if (!raw) {
            return fallback;
        }
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function writeScopedJson(key: string, value: unknown): boolean {
    try {
        return writeScopedItem(key, JSON.stringify(value));
    } catch {
        return false;
    }
}
