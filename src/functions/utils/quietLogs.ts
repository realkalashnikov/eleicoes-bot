const noisyPatterns = [
  "Slash command >",
  "Event >",
  "Constatic Base",
  "discord.js",
  "command%s registered",
  "commands registered in",
  "Verificando Application Emojis",
  "Sincronização de Application Emojis finalizada",
];

export function installQuietLogs(): void {
  const log = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    const text = args.map(String).join(" ");
    if (noisyPatterns.some(pattern => text.includes(pattern))) return;
    log(...args);
  };
}
