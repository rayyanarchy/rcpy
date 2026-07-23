import { createApp } from "./app.js";
import { getConfig } from "./config.js";

const config = getConfig();
const app = await createApp();

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Crumbly is running on http://localhost:${config.port}`);
});
