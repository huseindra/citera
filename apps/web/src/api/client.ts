// Thin fetch wrapper. Response types are hand-written in types.ts until
// the openapi-typescript pipeline lands.

async function handle<T>(resp: Response, method: string, path: string): Promise<T> {
  if (!resp.ok) {
    let detail = `${resp.status}`;
    try {
      const body = await resp.json();
      if (body?.detail) detail = `${resp.status}: ${body.detail}`;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`${method} ${path} failed (${detail})`);
  }
  return resp.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  return handle(await fetch(`/api${path}`), "GET", path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle(resp, "POST", path);
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const resp = await fetch(`/api${path}`, { method: "POST", body: form });
  return handle(resp, "POST", path);
}

/** Upload with progress events — fetch can't report upload progress, XHR can. */
export function apiUploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as T);
      } else {
        let detail = `${xhr.status}`;
        try {
          detail = `${xhr.status}: ${JSON.parse(xhr.responseText).detail}`;
        } catch {
          /* non-JSON body */
        }
        reject(new Error(`POST ${path} failed (${detail})`));
      }
    };
    xhr.onerror = () => reject(new Error(`POST ${path} failed (network)`));
    xhr.send(form);
  });
}

export interface HealthResponse {
  status: "ok" | "degraded";
  db: string;
}
