import { createCommand } from "#base";
import {
  ApplicationCommandOptionType,
  ActionRowBuilder,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { bolaoBoard, getBolaoPanel, placeBolaoBet, BOLAO_CANDIDATES } from "#services";

const bolaoModal = new ModalBuilder({
  customId: "bolao:submit",
  title: "Bolão — 2º turno Presidente",
  components: [
    new LabelBuilder({ label: "Candidato", description: "Quem vai ganhar", component: {
      custom_id: "bolao:candidato",
      type: 3,
      options: BOLAO_CANDIDATES.map(name => ({ label: name, value: name })),
    } }),
    new LabelBuilder({ label: "Percentual final", description: "0 a 100, com vírgula se quiser", component: {
      custom_id: "bolao:percentual",
      type: 4,
      style: 1,
      min_length: 1,
      max_length: 5,
      required: true,
      placeholder: "51,5",
    } }),
  ] as any,
});

export const runBolaoCommand = async (interaction: ChatInputCommandInteraction) => {
  const acao = interaction.options.getString("acao");
  await interaction.deferReply({ ephemeral: acao === "apostar" });
  if (acao === "apostar") {
    try {
      const candidateName = interaction.options.getString("candidato");
      const betPercent = interaction.options.getNumber("percentual");
      if (!candidateName || betPercent === null) {
        await interaction.editReply("Informe candidato e percentual para apostar.");
        return;
      }
      await placeBolaoBet({ userId: interaction.user.id, userName: interaction.user.username, guildId: interaction.guildId || undefined, candidateName, betPercent });
      await interaction.editReply(`**Aposta registrada:** ${candidateName} com \`${betPercent.toFixed(1).replace(".", ",")}%\`.`);
    } catch (error) {
      await interaction.editReply(`Não foi possível registrar: ${(error as Error).message}`);
    }
    return;
  }
  if (acao === "ver") {
    await interaction.editReply({
      content: await bolaoBoard(interaction.guildId || undefined) || "Nenhuma aposta ainda.",
      allowedMentions: { users: [] },
    });
    return;
  }
  await interaction.editReply(await getBolaoPanel(interaction.guildId || undefined, interaction.user.id) as any);
};

export default createCommand({
  name: "bolao",
  description: "Bolão interativo: aposte o percentual final do 2º turno presidencial",
  options: [
    { name: "acao", description: "O que fazer", type: ApplicationCommandOptionType.String, required: false, choices: [{ name: "Abrir painel", value: "painel" }, { name: "Apostar direto", value: "apostar" }, { name: "Ver apostas", value: "ver" }] },
    { name: "candidato", description: "Quem vai vencer (apostar direto)", type: ApplicationCommandOptionType.String, required: false, choices: BOLAO_CANDIDATES.map(name => ({ name, value: name })) },
    { name: "percentual", description: "Percentual final do candidato (apostar direto)", type: ApplicationCommandOptionType.Number, required: false, max: 100, min: 0 },
  ] as any,
  async run(interaction: ChatInputCommandInteraction) {
    await runBolaoCommand(interaction);
  },
});

export { bolaoModal };
