import { strict as assert } from "node:assert";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], cwd: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts", ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

const cliRoot = path.resolve("tests").includes(path.sep)
  ? path.resolve(".")
  : process.cwd();

const validFixture = path.resolve(cliRoot, "tests/fixtures/valid-openapi.yaml");
const invalidFixture = path.resolve(cliRoot, "tests/fixtures/invalid-openapi.yaml");

test("validate returns JSON success output for a valid spec", async () => {
  const result = await runCli(["validate", validFixture, "--format", "json"], cliRoot);

  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout) as {
    ok: boolean;
    summary: {
      title: string;
      endpointCount: number;
    };
  };

  assert.equal(payload.ok, true);
  assert.equal(payload.summary.title, "Specora CLI Fixture");
  assert.equal(payload.summary.endpointCount, 1);
});

test("validate returns JSON failure output for an invalid spec", async () => {
  const result = await runCli(["validate", invalidFixture, "--format", "json"], cliRoot);

  assert.equal(result.code, 1);
  const payload = JSON.parse(result.stdout) as {
    ok: boolean;
    error: {
      message: string;
    };
  };

  assert.equal(payload.ok, false);
  assert.match(payload.error.message, /openapi|swagger/i);
});

test("export creates HTML file and returns success payload", async () => {
  const outputPath = path.resolve(cliRoot, "tests/fixtures/tmp-export.html");

  const result = await runCli([
    "export",
    validFixture,
    "--output",
    outputPath,
    "--format",
    "json"
  ], cliRoot);

  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout) as {
    ok: boolean;
    outputPath: string;
  };
  assert.equal(payload.ok, true);
  assert.equal(payload.outputPath, outputPath);

  const html = await fs.readFile(outputPath, "utf8");
  assert.match(html, /Specora CLI Fixture/);

  await fs.unlink(outputPath);
});

test("running CLI without arguments exits cleanly with usage output", async () => {
  const result = await runCli([], cliRoot);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage: specora/);
});
