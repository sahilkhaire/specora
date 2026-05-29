export type VariableTokenSegment =
  | { type: "text"; text: string }
  | { type: "var"; text: string; name: string };

const VARIABLE_TOKEN_PATTERN = /\{\{(\w+)\}\}/g;

export function splitVariableTokens(input: string): VariableTokenSegment[] {
  if (!input) return [{ type: "text", text: "" }];

  const segments: VariableTokenSegment[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(VARIABLE_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", text: input.slice(lastIndex, index) });
    }
    segments.push({ type: "var", text: match[0], name: match[1] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push({ type: "text", text: input.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", text: input }];
}

export function hasVariableTokens(input: string): boolean {
  return /\{\{\w+\}\}/.test(input);
}

export function variableTokenClass(name: string, variables: Record<string, string>): string {
  return Object.prototype.hasOwnProperty.call(variables, name)
    ? "env-var-token env-var-token--defined"
    : "env-var-token env-var-token--missing";
}
