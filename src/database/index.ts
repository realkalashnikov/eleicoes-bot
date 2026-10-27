// Camada de dados: conexão/models em models.ts, consultas em repos/*.ts.
// Este arquivo é o ponto de entrada do alias #database.
export { connectDatabase, getModels, getSnapshots } from "./models.js";
export * from "./repos/settingsRepo.js";
export * from "./repos/bolaoRepo.js";
export * from "./repos/alertsRepo.js";
export * from "./repos/snapshotsRepo.js";
export * from "./repos/observatoryRepo.js";
