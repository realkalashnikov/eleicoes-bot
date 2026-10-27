import { createRow } from "@magicyan/discord";

import { ButtonBuilder, ButtonStyle } from "discord.js";
import { icon } from "#functions";

export function paginator(id: string, page: number, pages: number) {
  if (pages < 2) return null;
  return createRow(
    new ButtonBuilder({
      customId: `${id}:${page - 2}`,
      emoji: icon.angles_left,
      style: ButtonStyle.Secondary,
      disabled: page < 2,
    }),
    new ButtonBuilder({
      customId: `${id}:${page - 1}`,
      emoji: icon.angle_left,
      style: ButtonStyle.Secondary,
      disabled: page === 0,
    }),
    new ButtonBuilder({
      customId: `${id}:noop`,
      label: `${page + 1}/${pages}`,
      style: ButtonStyle.Secondary,
      disabled: true,
    }),
    new ButtonBuilder({
      customId: `${id}:${page + 1}`,
      emoji: icon.angle_right,
      style: ButtonStyle.Primary,
      disabled: page >= pages - 1,
    }),
    new ButtonBuilder({
      customId: `${id}:${page + 2}`,
      emoji: icon.angles_right,
      style: ButtonStyle.Primary,
      disabled: page + 2 > pages - 1,
    }),
  );
}
