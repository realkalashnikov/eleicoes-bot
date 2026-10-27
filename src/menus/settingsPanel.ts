import {
  brBuilder,
  createContainer,
  createRow,
  Separator,
} from "@magicyan/discord";
import {
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  StringSelectMenuBuilder,
} from "discord.js";
import type { ChannelKey } from "../database/index.js";
import { icon } from "../functions/utils/icon.js";

const channels = [
  {
    key: "election",
    label: "Apuração",
    emoji: icon.ballot_box,
    detail: "Painel fixo e atualização oficial do TSE.",
  },
  {
    key: "news",
    label: "Notícias",
    emoji: icon.chart_bar,
    detail: "Novos itens importados dos feeds RSS.",
  },
  {
    key: "polls",
    label: "Pesquisas",
    emoji: icon.chart_bar,
    detail: "Pesquisas eleitorais registradas.",
  },
  {
    key: "influence",
    label: "Influência",
    emoji: icon.globe,
    detail: "Eventos, fontes e evidências documentadas.",
  },
];

export function buildSettingsPanel<R = any>(
  settings: any,
  selected?: ChannelKey,
): R {
  const selectedInfo = channels.find((item) => item.key === selected);
  const select = new StringSelectMenuBuilder({
    customId: "settings:channels:select",
    placeholder: "Escolher canal para configurar...",
    options: channels.map((item) => ({
      label: item.label,
      value: item.key,
      description: item.detail,
      default: item.key === selected,
      emoji: item.emoji.toJSON(),
    })),
  });

  const lines = channels.map(
    (item) =>
      `> ${item.emoji} **${item.label}:** ${settings.channels?.[item.key] ? `<#${settings.channels[item.key]}>` : "não configurado"}`,
  );
  const parts: any[] = [
    brBuilder(
      `## ${icon.settings} Configurações do Observatório`,
      `> **Prefixo deste servidor:** \`${settings.prefix || "e."}\``,
      "Configure onde cada tipo de dado será publicado.",
    ),
    Separator.Default,
    brBuilder("### Canais", ...lines),
    Separator.Default,
    createRow(select),
  ];

  if (selectedInfo) {
    parts.push(
      brBuilder(
        `### ${selectedInfo.emoji} Canal de ${selectedInfo.label}`,
        selectedInfo.detail,
      ),
      createRow(
        new ChannelSelectMenuBuilder({
          customId: `settings:channels:set:${selectedInfo.key}`,
          placeholder: `Selecionar canal de ${selectedInfo.label.toLowerCase()}...`,
          channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
        }),
      ),
    );
  }

  parts.push(
    Separator.Default,
    createRow(
      new ButtonBuilder({
        customId: "settings:refresh",
        label: "Atualizar",
        style: ButtonStyle.Secondary,
      }).setEmoji(icon.refresh.toJSON()),
      new ButtonBuilder({
        customId: "settings:publish-election",
        label: "Enviar painel agora",
        style: ButtonStyle.Success,
      }).setEmoji(icon.send.toJSON()),
      new ButtonBuilder({
        customId: "settings:prefix",
        label: "Trocar Prefixo",
        style: ButtonStyle.Primary,
      }).setEmoji(icon.settings.toJSON()),
    ),
  );

  return {
    flags: ["Ephemeral", "IsComponentsV2"],
    components: [createContainer(0x2b2d31, ...parts)],
  } as R;
}
