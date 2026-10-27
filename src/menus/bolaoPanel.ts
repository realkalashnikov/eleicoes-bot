import { brBuilder, createContainer, createRow, Separator } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { icon } from "../functions/utils/icon.js";

export interface BolaoView { stats: string; board: string; closed: boolean }

export function buildBolaoPanel<R = any>(view: BolaoView): R {
  const apostar = new ButtonBuilder({
    customId: "bolao:open",
    label: view.closed ? "Apostar (bloqueado)" : "Apostar agora",
    style: ButtonStyle.Primary,
    disabled: view.closed,
  }).setEmoji(icon.ballot_box.toJSON());
  const board = new ButtonBuilder({
    customId: "bolao:board",
    label: "Ver apostas",
    style: ButtonStyle.Secondary,
  }).setEmoji(icon.chart_bar.toJSON());
  return {
    flags: ["IsComponentsV2"],
    components: [createContainer(
      0xFFDF00,
      brBuilder(
        `## ${icon.trophy} Bolão — Presidente • 2º turno`,
        view.stats,
      ),
      Separator.Default,
      brBuilder(view.board || "> Sem apostas ainda."),
      Separator.Default,
      brBuilder("> Pontuação: 100 pontos menos a diferença entre sua aposta e o resultado oficial. Uma aposta por pessoa; apostar de novo substitui."),
      createRow(apostar, board),
    )],
  } as R;
}
