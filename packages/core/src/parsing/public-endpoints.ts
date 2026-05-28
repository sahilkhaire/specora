import type { OperationItem } from "./operation-types.js";

export type PublicFilterStrategy =
  | "tag:public"
  | "extension"
  | "no-security"
  | "all";

export interface PublicFilterOptions {
  strategy?: PublicFilterStrategy;
  includeAll?: boolean;
}

function operationHasNoSecurity(operation: Record<string, unknown>): boolean {
  if (!("security" in operation)) {
    return true;
  }
  const security = operation.security;
  return Array.isArray(security) && security.length === 0;
}

function operationIsPublicByTag(tags: string[]): boolean {
  return tags.some((tag) => tag.toLowerCase() === "public");
}

export function filterPublicOperations(
  operations: OperationItem[],
  paths: Record<string, unknown>,
  options: PublicFilterOptions = {}
): OperationItem[] {
  if (options.includeAll || options.strategy === "all") {
    return operations;
  }

  const strategy = options.strategy ?? "tag:public";

  return operations.filter((operation) => {
    const pathItem = paths[operation.path] as Record<string, unknown> | undefined;
    const methodKey = operation.method.toLowerCase();
    const opItem = pathItem?.[methodKey] as Record<string, unknown> | undefined;

    if (strategy === "no-security" && opItem) {
      return operationHasNoSecurity(opItem);
    }

    if (strategy === "extension" && opItem) {
      const visibility = opItem["x-specora-visibility"];
      return visibility === "public";
    }

    if (operationIsPublicByTag(operation.tags)) {
      return true;
    }

    if (strategy === "tag:public") {
      return operationIsPublicByTag(operation.tags);
    }

    return false;
  });
}
