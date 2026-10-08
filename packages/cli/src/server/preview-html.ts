import type { PreviewPayload } from "../types/cli-types.js";
import { escapeHtml } from "../utils/html.js";

export function generatePreviewHtml(payload: PreviewPayload): string {
  const { summary, spec } = payload;
  const prettySpec = escapeHtml(JSON.stringify(spec, null, 2));
  const tags = escapeHtml(summary.tags.length > 0 ? summary.tags.join(", ") : "No tags");
  const title = escapeHtml(summary.title);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - Specora Preview</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 2rem; color: #102a43; background: #f4f8fb; }
    .card { background: #fff; border: 1px solid #d9e2ec; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 10px 25px rgba(16, 42, 67, 0.05); }
    h1 { margin: 0 0 0.75rem 0; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    pre { white-space: pre-wrap; background: #102a43; color: #f0f4f8; padding: 1rem; border-radius: 10px; overflow: auto; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p><strong>Version:</strong> ${escapeHtml(summary.version)}</p>
    <p><strong>Paths:</strong> ${escapeHtml(summary.endpointCount)}</p>
    <p><strong>Tags:</strong> ${tags}</p>
  </div>
  <div class="card">
    <h2>Raw Spec</h2>
    <pre>${prettySpec}</pre>
  </div>
</body>
</html>`;
}
