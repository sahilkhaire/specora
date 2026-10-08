import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export function startPreviewServer(port: number, html: string, host = "127.0.0.1"): void {
  const server = createServer((_req: IncomingMessage, res: ServerResponse) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(html);
  });

  server.listen(port, host, () => {
    console.log(`Specora preview running at http://${host}:${port}`);
  });
}
