import { bootstrap } from "@constatic/base";
import { connectDatabase } from "./database/index.js";
import { installQuietLogs } from "./functions/utils/quietLogs.js";

installQuietLogs();
await bootstrap({
  meta: import.meta,
  env: { BOT_TOKEN: process.env.BOT_TOKEN },
  beforeLoad: async () => {
    await connectDatabase();
  },
  loadLogs: false,
});
