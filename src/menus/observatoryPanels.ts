import {
  brBuilder,
  createContainer,
  createRow,
  Separator,
} from "@magicyan/discord";
import {
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { icon } from "#functions";
import { paginator } from "./paginator.js";

function panel<R = any>(
  color: number,
  title: string,
  body: string,
  footer: string,
): R {
  return {
    flags: ["IsComponentsV2"],
    components: [
      createContainer(
        color,
        brBuilder(title),
        Separator.Default,
        brBuilder(body),
        Separator.Default,
        brBuilder(`> ${footer}`),
      ),
    ],
  } as R;
}

export function buildCandidatePanel<R = any>(name: string, report: string): R {
  return panel(
    0x009c3b,
    `## ${icon.ballot_box} Candidato — ${name}`,
    report,
    "Dados públicos cadastrados no observatório. Confira fontes antes de compartilhar.",
  );
}

export function buildPollPanel<R = any>(
  office: string,
  round: number | undefined,
  report: string,
  view: { page: number; pages: number; detailed: boolean } = { page: 0, pages: 1, detailed: false },
): R {
  const currentRound = round || 2;
  const flag = view.detailed ? 1 : 0;
  const officeMenu = new StringSelectMenuBuilder({ customId: `poll:office:${office}:${currentRound}:${flag}`, placeholder: "Cargo" }).addOptions(
    new StringSelectMenuOptionBuilder({ label: "Presidente", value: "presidente", default: office === "presidente" }),
    new StringSelectMenuOptionBuilder({ label: "Governador", value: "governador", default: office === "governador" }),
  );
  const roundMenu = new StringSelectMenuBuilder({ customId: `poll:round:${office}:${currentRound}:${flag}`, placeholder: "Turno" }).addOptions(
    new StringSelectMenuOptionBuilder({ label: "1º turno", value: "1", default: currentRound === 1 }),
    new StringSelectMenuOptionBuilder({ label: "2º turno", value: "2", default: currentRound === 2 }),
  );
  const toggle = new ButtonBuilder({
    customId: `poll:toggle:${office}:${currentRound}:${view.page}:${flag ? 0 : 1}`,
    label: view.detailed ? "Resumir" : "Detalhar",
    style: ButtonStyle.Secondary,
  }).setEmoji(icon.chart_bar.toJSON());
  const compare = new ButtonBuilder({
    customId: "poll:compare",
    label: "Pesquisa x Apuração",
    style: ButtonStyle.Secondary,
  });
  const pageRow = paginator(`poll:page:${office}:${currentRound}:${flag}`, view.page, view.pages);
  return {
    flags: ["IsComponentsV2"],
    components: [createContainer(
      0x5865f2,
      brBuilder(`## ${icon.chart_bar} Pesquisas — ${office} • ${currentRound}º turno`),
      Separator.Default,
      brBuilder(report),
      Separator.Default,
      brBuilder("> Pesquisa não é resultado eleitoral. Dados compilados de fontes jornalísticas; confira registro no TSE. Média não é previsão."),
      createRow(officeMenu),
      createRow(roundMenu),
      ...(pageRow ? [pageRow] : []),
      createRow(toggle, compare),
    )],
  } as R;
}

export function buildNewsPanel<R = any>(report: string): R {
  return panel(
    0xfee75c,
    `## ${icon.chart_bar} Notícias Eleitorais`,
    report,
    "Links levam à fonte original. Notícias não equivalem a fatos confirmados.",
  );
}

export function buildInfluencePanel<R = any>(
  actor: string | undefined,
  report: string,
): R {
  return panel(
    0x9b59b6,
    `## ${icon.globe} Influência Política${actor ? ` — ${actor}` : ""}`,
    report,
    "Correlação não prova causalidade. Consulte evidências e explicações alternativas.",
  );
}

export function buildSourcesPanel<R = any>(report: string): R {
  return panel(
    0x2b2d31,
    "## Fontes do Observatório",
    report,
    "Prioridade para fontes oficiais, metodologia e URL verificável.",
  );
}

export function buildCampaignFinancePanel<R = any>(
  name: string,
  report: string,
  election?: string,
  category?: string,
  viewId?: string,
): R {
  const choices = [
    ["Resumo", "all"], ["Patrimônio", "assets"], ["Receitas", "income"],
    ["Despesas", "expense"], ["Fundos", "fund"],
  ] as const;
  const buttons = viewId ? createRow(...choices.map(([label, value]) => new ButtonBuilder({
    customId: `campaign:view:${viewId}:${value}`,
    label,
    style: value === (category || "all") ? ButtonStyle.Primary : ButtonStyle.Secondary,
  }))) : null;
  return {
    flags: ["IsComponentsV2"],
    components: [createContainer(
      0x00a86b,
      brBuilder(`## ${icon.ballot_box} Campanha — ${name}${election ? ` • ${election}` : ""}`),
      Separator.Default,
      brBuilder(report),
      ...(buttons ? [Separator.Default, buttons] : []),
      Separator.Default,
      brBuilder("> Valores dependem de importação oficial do TSE. Confira fonte, eleição e categoria."),
    )],
  } as R;
}

export function buildSearchPanel<R = any>(data: {
  id: string;
  query: string;
  total: number;
  page: number;
  pages: number;
  items: Array<{ id: string; type: string; title: string; subtitle: string }>;
}): R {
  const type = {
    candidate: { label: "Candidato", emoji: icon.ballot_box },
    news: { label: "Notícia", emoji: icon.chart_bar },
    poll: { label: "Pesquisa", emoji: icon.chart_bar },
    influence: { label: "Influência", emoji: icon.globe },
    source: { label: "Fonte", emoji: icon.settings },
  } as Record<string, { label: string; emoji: typeof icon.ballot_box }>;
  const meta = (kind: string) => type[kind] || { label: kind, emoji: icon.settings };
  const body = data.items.length
    ? data.items
        .map(
          (item, index) =>
            `**${index + 1}. ${item.title}** — ${meta(item.type).emoji} ${meta(item.type).label} • ${item.subtitle}`,
        )
        .join("\n\n")
    : `Nenhum resultado para **${data.query}**.`;
  const components: any[] = [
      brBuilder(`## ${icon.settings} Busca global — ${data.query}`),
    brBuilder(
      `> Resultados encontrados em perfis, notícias, pesquisas, eventos e fontes.`,
    ),
    Separator.Default,
    brBuilder(body),
    Separator.Default,
  ];
  if (data.items.length) {
    const select = new StringSelectMenuBuilder({
      customId: `search:pick:${data.id}:${data.page}`,
      placeholder: "Abrir resultado...",
    });
    select.addOptions(
      data.items.map(
        (item) =>
          new StringSelectMenuOptionBuilder({
            label: item.title.slice(0, 100),
            description: `${meta(item.type).label} • ${item.subtitle}`.slice(0, 100),
            value: item.id,
          }).setEmoji(meta(item.type).emoji.toJSON()),
      ),
    );
    components.push(createRow(select));
  }
  const navigation = paginator(`search:page:${data.id}`, data.page, data.pages);
  if (navigation) components.push(navigation);
  components.push(
    brBuilder(
      `> ${data.total} resultado(s) • Página ${data.page + 1}/${data.pages} • Selecione item para detalhes.`,
    ),
  );
  return {
    flags: ["IsComponentsV2"],
    components: [createContainer(0x3498db, ...components)],
  } as R;
}

export function buildSearchDetailPanel<R = any>(
  id: string,
  page: number,
  title: string,
  body: string,
): R {
  return {
    flags: ["IsComponentsV2"],
    components: [
      createContainer(
        0x3498db,
        brBuilder(`## ${icon.settings} ${title}`),
        Separator.Default,
        brBuilder(body),
        Separator.Default,
        createRow(
          new ButtonBuilder({
            customId: `search:page:${id}:${page}`,
            label: "Voltar aos resultados",
            style: ButtonStyle.Secondary,
          }),
        ),
        brBuilder("> Dados e fontes podem ser atualizados ou corrigidos."),
      ),
    ],
  } as R;
}
