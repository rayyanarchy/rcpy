import { createApp } from "./app.js";
import { getConfig } from "./config.js";
import { APP_NAME } from "./constants.js";

const config = getConfig();
const app = await createApp();

app.listen(config.port, "0.0.0.0", () => {
  console.log(`${APP_NAME} is running on http://localhost:${config.port}`);
});
