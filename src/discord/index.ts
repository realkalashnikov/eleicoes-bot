import { setupCreators } from "@constatic/base";

export * from "@constatic/base";

export const { createCommand, createEvent, createResponder } = setupCreators({
  commands: {
    guilds: process.env.GUILD_ID ? [process.env.GUILD_ID] : [],
  },
});
