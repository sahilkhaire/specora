import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export function startPreviewServer(port: number, html: string): void {
  const server = createServer((_req: IncomingMessage, res: ServerResponse) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  });

  server.listen(port, () => {
    console.log(`Specora preview running at http://localhost:${port}`);
  });
}
