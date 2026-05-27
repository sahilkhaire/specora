import { promises as fs } from "node:fs";
import path from "node:path";
import { parseAndValidateSpec } from "@specora/core";
import type { ParsedSpecFile } from "../types/cli-types.js";

export async function readSpecText(specPath: string): Promise<string> {
  const absolute = path.resolve(specPath);
  return fs.readFile(absolute, "utf8");
}

export async function parseFromFile(specPath: string): Promise<ParsedSpecFile> {
  const text = await readSpecText(specPath);
  const result = await parseAndValidateSpec({
    sourceType: "text",
    value: text
  });

  return { result, text };
}

export async function writeTextFile(filePath: string, content: string): Promise<string> {
  const absolute = path.resolve(filePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, "utf8");
  return absolute;
}
