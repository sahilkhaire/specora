import { getSpecoraEmbedConfig } from "@/config/deployment";

function normalizePath(pathname: string): string {
    const trimmed = pathname.replace(/\/+$/, "") || "/";
    return trimmed;
}

function resolveAgainstOrigin(value: string): string {
    if (typeof window === "undefined") {
        return value;
    }

    try {
        return new URL(value, window.location.origin).href;
    } catch {
        return value;
    }
}

/** Stable document identity for scoping browser storage. */
export function getStorageScopeId(): string {
    const embed = getSpecoraEmbedConfig();
    if (embed) {
        if (embed.mountPath?.trim()) {
            const mount = embed.mountPath.trim().replace(/\/+$/, "") || "/";
            if (typeof window !== "undefined") {
                return `${window.location.origin}${mount}`;
            }
            return mount;
        }
        if (embed.specUrl?.trim()) {
            return resolveAgainstOrigin(embed.specUrl.trim());
        }
    }

    if (typeof window === "undefined") {
        return "default";
    }

    return `${window.location.origin}${normalizePath(window.location.pathname)}`;
}

function hashScopeId(scopeId: string): string {
    let hash = 5381;
    for (let i = 0; i < scopeId.length; i++) {
        hash = ((hash << 5) + hash + scopeId.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
}

export function getStorageScopeHash(): string {
    return hashScopeId(getStorageScopeId());
}

/** Prefix a base storage key with the current document scope. */
export function scopedKey(baseKey: string): string {
    return `specora:${getStorageScopeHash()}:${baseKey}`;
}

/** Deterministic workspace id for embed/docs surfaces (one per document URL). */
export function getEmbedWorkspaceId(): string {
    return `embed-${getStorageScopeHash()}`;
}

export function getScopedIndexedDbName(): string {
    return `specora-${getStorageScopeHash()}`;
}
