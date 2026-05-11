import app from "./index";

const port = Number(process.env.PORT) || 3000;

console.log(`[server] starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
