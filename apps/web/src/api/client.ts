// Thin fetch wrapper. Response types are hand-written until the
// openapi-typescript pipeline lands (T5.1).
export async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`/api${path}`);
  if (!resp.ok) {
    throw new Error(`GET ${path} failed: ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  db: string;
}
