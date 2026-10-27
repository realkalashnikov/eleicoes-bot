import { createCommand } from "#base";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import { CONFIG } from "#config";
import { getElectionPanel } from "#services";

export async function runElectionCommand(interaction: {
  options: { getString(name: string): string | null };
  deferReply(): Promise<unknown>;
  editReply(payload: unknown): Promise<unknown>;
}) {
  const uf = interaction.options.getString("uf") || "br";
  const cargo = interaction.options.getString("cargo") || "1";
  const election = interaction.options.getString("eleicao") || CONFIG.FED_ELECTION;

  if (!/^[a-z]{2}$/i.test(uf) || !/^\d{1,4}$/.test(cargo) || !/^\d{1,6}$/.test(election)) {
    throw new Error("Parâmetros de eleição inválidos.");
  }

  await interaction.deferReply();
  await interaction.editReply(await getElectionPanel(uf.toLowerCase(), cargo, election));
}

export default createCommand({
  name: "apuracao",
  description: "Consulta apuração eleitoral oficial do TSE",
  aliases: ["eleicao", "eleições", "apuracao-eleitoral"],
  options: [
    { name: "uf", description: "UF ou br para resultado nacional", type: ApplicationCommandOptionType.String, required: false, maxLength: 2 },
    { name: "cargo", description: "Código TSE do cargo", type: ApplicationCommandOptionType.String, required: false, maxLength: 4 },
    { name: "eleicao", description: "Código da eleição no TSE", type: ApplicationCommandOptionType.String, required: false, maxLength: 6 },
  ],
  async run(interaction: ChatInputCommandInteraction) {
    await runElectionCommand(interaction);
  },
} as any);
