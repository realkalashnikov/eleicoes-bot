import { buildElectionPanel } from "./electionPanel.js";
import {
  buildCandidatePanel,
  buildInfluencePanel,
  buildNewsPanel,
  buildPollPanel,
  buildSourcesPanel,
  buildCampaignFinancePanel,
  buildSearchPanel,
  buildSearchDetailPanel,
} from "./observatoryPanels.js";
import { buildSettingsPanel } from "./settingsPanel.js";
import { buildErrorPanel, buildNoticePanel } from "./feedback.js";

export const menus = {
  election: { panel: buildElectionPanel },
  observatory: {
    candidate: buildCandidatePanel,
    poll: buildPollPanel,
    news: buildNewsPanel,
    influence: buildInfluencePanel,
    sources: buildSourcesPanel,
    campaign: buildCampaignFinancePanel,
    search: buildSearchPanel,
    searchDetail: buildSearchDetailPanel,
  },
  settings: { main: buildSettingsPanel },
  feedback: { error: buildErrorPanel, notice: buildNoticePanel },
};

export * from "./electionPanel.js";
export * from "./observatoryPanels.js";
export * from "./settingsPanel.js";
export * from "./feedback.js";
export * from "./paginator.js";
