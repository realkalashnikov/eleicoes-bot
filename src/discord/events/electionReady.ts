import { createEvent } from "#base";
import { startElectionAlerts, startLiveElectionPanel, startSourceScheduler } from "#services";

createEvent({
  name: "election-ready",
  event: "clientReady",
  once: true,
  async run(client) {
    await startLiveElectionPanel(client);
    await startSourceScheduler(client);
    await startElectionAlerts(client);
  },
});
