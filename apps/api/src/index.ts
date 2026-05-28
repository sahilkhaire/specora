import { serve } from "@hono/node-server";
import { initDb } from "./db/client.js";
import { ensureDefaultInstance } from "./routes/admin.js";
import { createApp } from "./app.js";

initDb();
await ensureDefaultInstance();

const app = createApp();
const port = Number(process.env.PORT ?? 8788);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Specora API listening on http://localhost:${port}`);
});

export default app;
