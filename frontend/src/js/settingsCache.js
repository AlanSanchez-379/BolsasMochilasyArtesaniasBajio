import { api } from "./api.js";

let cache = null;

export async function getSettings() {
  if (!cache) cache = await api.getSettings();
  return cache;
}

export function invalidateSettingsCache() {
  cache = null;
}
