import { extractOperations, filterOperations } from "../apps/web/src/features/spec/spec-utils.ts";

function nowMs() {
  return performance.now();
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function baselineFilterOperations(operations, methodFilter, searchTerm) {
  const query = searchTerm.trim().toLowerCase();
  return operations.filter((operation) => {
    const methodMatch = methodFilter === "ALL" || operation.method === methodFilter;
    const searchMatch = !query
      || operation.path.toLowerCase().includes(query)
      || operation.summary.toLowerCase().includes(query)
      || operation.tags.some((tag) => tag.toLowerCase().includes(query));
    return methodMatch && searchMatch;
  });
}

function baselineSelectOperation(filtered, selectedKey) {
  if (!selectedKey) {
    return filtered[0] ?? null;
  }
  return filtered.find((operation) => `${operation.method}:${operation.path}:${operation.operationId}` === selectedKey)
    ?? filtered[0]
    ?? null;
}

function optimizedSelectOperation(filtered, selectedKey) {
  if (!selectedKey) {
    return filtered[0] ?? null;
  }
  return filtered.find((operation) => operation.key === selectedKey) ?? filtered[0] ?? null;
}

function makeLargeSpec(pathCount = 1500) {
  const paths = {};
  for (let i = 0; i < pathCount; i += 1) {
    paths[`/resource/${i}`] = {
      get: {
        summary: `Fetch resource ${i}`,
        operationId: `getResource${i}`,
        tags: [`group-${i % 20}`, i % 2 === 0 ? "common" : "alt"]
      },
      post: {
        summary: `Create resource ${i}`,
        operationId: `createResource${i}`,
        tags: [`group-${i % 20}`, "mutations"]
      }
    };
  }

  return {
    openapi: "3.0.3",
    info: { title: "Benchmark API", version: "1.0.0" },
    paths
  };
}

function measureP95(operations, iterations = 120) {
  const baselineDurations = [];
  const optimizedDurations = [];

  for (let i = 0; i < iterations; i += 1) {
    const method = i % 3 === 0 ? "GET" : "ALL";
    const query = i % 4 === 0 ? "resource 12" : i % 5 === 0 ? "group-9" : "resource";
    const selectedKey = operations[(i * 17) % operations.length]?.key ?? "";

    const baselineStart = nowMs();
    const baselineFiltered = baselineFilterOperations(operations, method, query);
    baselineSelectOperation(baselineFiltered, selectedKey);
    baselineDurations.push(nowMs() - baselineStart);

    const optimizedStart = nowMs();
    const optimizedFiltered = filterOperations(operations, method, query);
    optimizedSelectOperation(optimizedFiltered, selectedKey);
    optimizedDurations.push(nowMs() - optimizedStart);
  }

  return {
    baselineP95Ms: percentile(baselineDurations, 95),
    optimizedP95Ms: percentile(optimizedDurations, 95)
  };
}

function main() {
  const spec = makeLargeSpec();
  const operations = extractOperations(spec);
  const { baselineP95Ms, optimizedP95Ms } = measureP95(operations);
  const improvementPct = baselineP95Ms > 0
    ? ((baselineP95Ms - optimizedP95Ms) / baselineP95Ms) * 100
    : 0;

  const report = {
    operationCount: operations.length,
    baselineP95Ms: Number(baselineP95Ms.toFixed(3)),
    optimizedP95Ms: Number(optimizedP95Ms.toFixed(3)),
    improvementPct: Number(improvementPct.toFixed(2))
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
