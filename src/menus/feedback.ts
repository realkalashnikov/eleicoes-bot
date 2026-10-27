import { brBuilder, createContainer } from "@magicyan/discord";

export function buildErrorPanel<R = any>(message: string): R {
  return {
    flags: ["IsComponentsV2"],
    components: [createContainer(0xED4245, brBuilder("## ⚠️ Não foi possível concluir", message))],
  } as R;
}

export function buildNoticePanel<R = any>(title: string, message: string, ephemeral = false): R {
  return {
    flags: ["IsComponentsV2", ...(ephemeral ? ["Ephemeral"] : [])],
    components: [createContainer(0x5865F2, brBuilder(`## ℹ️ ${title}`, message))],
  } as R;
}
