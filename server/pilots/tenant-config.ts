import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const CONFIG_ROOT = path.resolve(process.cwd(), "config", "tenants");

const cache = new Map<string, unknown>();

function cacheKey(tenantSlug: string, file: string) {
  return `${tenantSlug}::${file}`;
}

export async function loadTenantConfigRaw(tenantSlug: string, file: string): Promise<string> {
  const key = cacheKey(tenantSlug, file);
  const cached = cache.get(key);
  if (typeof cached === "string") return cached;

  const filePath = path.join(CONFIG_ROOT, tenantSlug, file);
  if (!filePath.startsWith(CONFIG_ROOT)) {
    throw new Error("Invalid tenant config path");
  }
  const contents = await readFile(filePath, "utf8");
  cache.set(key, contents);
  return contents;
}

export async function loadTenantYaml<T>(tenantSlug: string, file: string): Promise<T> {
  const key = cacheKey(tenantSlug, `yaml::${file}`);
  const cached = cache.get(key);
  if (cached) return cached as T;

  const raw = await loadTenantConfigRaw(tenantSlug, file);
  const parsed = parseYaml(raw) as T;
  cache.set(key, parsed);
  return parsed;
}

export function clearTenantConfigCache() {
  cache.clear();
}
