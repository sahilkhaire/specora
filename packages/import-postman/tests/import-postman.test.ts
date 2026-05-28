import assert from "node:assert/strict";
import {
  detectPostmanFile,
  exportPostmanCollectionV21,
  exportPostmanEnvironment,
  importPostmanCollection,
  importPostmanEnvironment
} from "../src/index.js";

const v21 = {
  info: {
    name: "Demo",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    {
      name: "Users",
      item: [
        {
          name: "List users",
          request: {
            method: "GET",
            header: [],
            url: { raw: "https://api.example.com/users" }
          }
        }
      ]
    }
  ]
};

void (async () => {
  const detected = detectPostmanFile(v21);
  assert.equal(detected.kind, "collection");
  assert.equal(detected.collectionFormat, "v2.1");

  const imported = await importPostmanCollection(v21);
  assert.ok(imported);
  assert.equal(imported!.requests.length, 1);
  assert.equal(imported!.requests[0]?.method, "GET");

  const exported = exportPostmanCollectionV21(imported!);
  assert.ok(exported.info);

  const env = importPostmanEnvironment({
    name: "Staging",
    values: [{ key: "baseUrl", value: "https://api.example.com", enabled: true }]
  });
  assert.ok(env);
  assert.equal(env!.variables.baseUrl, "https://api.example.com");
  const envOut = exportPostmanEnvironment("Staging", env!.variables);
  assert.equal(envOut.name, "Staging");

  const v20 = {
    info: {
      name: "V20",
      schema: "https://schema.getpostman.com/json/collection/v2.0.0/collection.json"
    },
    item: [
      {
        name: "Health",
        request: {
          method: "GET",
          url: "https://api.example.com/health"
        }
      }
    ]
  };

  const imported20 = await importPostmanCollection(v20);
  assert.ok(imported20);
  assert.equal(imported20!.requests[0]?.url, "https://api.example.com/health");

  console.log("import-postman.test.ts: ok");
})();
