import { createEvent } from "#base";
import { handleInteraction } from "../../responders/interactions.js";

createEvent({
  name: "election-interactions",
  event: "interactionCreate",
  async run(interaction) {
    if (!interaction.isCommand()) await handleInteraction(interaction);
  },
});
