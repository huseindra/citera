// Citera SDK — a thin, typed client over the canonical REST API.
// Business logic lives in the Review Engine; the SDK only moves bytes.
//
//   import Citera from "@citera/sdk";
//   const citera = new Citera({ apiKey: process.env.CITERA_API_KEY });
//   const protocol = await citera.documents.upload({ file, kind: "protocol" });
//   const icf = await citera.documents.upload({ file, kind: "icf" });
//   const review = await citera.reviews.create({
//     document: icf.id, protocol: protocol.id, ruleset: "fda",
//   });
//   const result = await citera.reviews.waitUntilComplete(review.id);

import type {
  Document,
  DocumentKind,
  DocumentText,
  FindingDetail,
  Review,
  ReviewReport,
  ReviewSummary,
  Ruleset,
  RulesetInfo,
} from "./types.js";

export * from "./types.js";

export interface CiteraOptions {
  /** API key. Defaults to the CITERA_API_KEY environment variable. */
  apiKey?: string;
  /** API base URL. Defaults to CITERA_BASE_URL or http://localhost:8000. */
  baseUrl?: string;
}

export class CiteraError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CiteraError";
  }
}

interface WaitOptions {
  /** Give up after this many milliseconds (default 180 000). */
  timeoutMs?: number;
  /** Poll interval in milliseconds (default 1 500). */
  pollMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Http {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
  ) {}

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.apiKey) headers.set("Authorization", `Bearer ${this.apiKey}`);
    const response = await fetch(`${this.baseUrl}/v1${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const body = (await response.json()) as { detail?: unknown };
        if (body?.detail) detail = String(body.detail);
      } catch {
        // non-JSON error body — keep the status text
      }
      throw new CiteraError(detail, response.status);
    }
    return response;
  }

  async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    return (await this.request(path, init)).json() as Promise<T>;
  }
}

export interface UploadParams {
  /** File contents: Blob/File, byte array, or plain text. */
  file: Blob | Uint8Array | ArrayBuffer | string;
  /** Filename sent to the API — the extension drives extraction. */
  filename?: string;
  kind: DocumentKind;
}

class Documents {
  constructor(private http: Http) {}

  async upload(params: UploadParams): Promise<Document> {
    const filename =
      params.filename ??
      (params.file instanceof File ? params.file.name : "document.md");
    const blob =
      params.file instanceof Blob
        ? params.file
        : new Blob([
            typeof params.file === "string"
              ? params.file
              : // copy into a fresh ArrayBuffer-backed view (BlobPart
                // rejects SharedArrayBuffer-backed typed arrays)
                new Uint8Array(
                  params.file instanceof ArrayBuffer
                    ? params.file
                    : Uint8Array.from(params.file),
                ),
          ]);
    const form = new FormData();
    form.set("file", blob, filename);
    form.set("kind", params.kind);
    return this.http.json<Document>("/documents", {
      method: "POST",
      body: form,
    });
  }

  get(documentId: string): Promise<Document> {
    return this.http.json<Document>(`/documents/${documentId}`);
  }

  list(): Promise<Document[]> {
    return this.http.json<Document[]>("/documents");
  }

  text(documentId: string): Promise<DocumentText> {
    return this.http.json<DocumentText>(`/documents/${documentId}/text`);
  }

  /** Ingestion is asynchronous — wait until chunking has finished. */
  async waitUntilReady(
    documentId: string,
    options: WaitOptions = {},
  ): Promise<Document> {
    const deadline = Date.now() + (options.timeoutMs ?? 180_000);
    for (;;) {
      const document = await this.get(documentId);
      if (document.status === "ready") return document;
      if (document.status === "failed") {
        throw new CiteraError(
          `Document ingestion failed: ${document.status_reason ?? "unknown"}`,
        );
      }
      if (Date.now() > deadline) {
        throw new CiteraError(
          `Timed out waiting for document ${documentId} to become ready`,
        );
      }
      await sleep(options.pollMs ?? 1_500);
    }
  }
}

export interface CreateReviewParams {
  /** The document under review (usually the ICF). */
  document: string;
  /** The study protocol to verify against. */
  protocol: string;
  /** Ruleset pack id or alias, e.g. "fda" or "fda-21cfr50". */
  ruleset?: string;
  /** Draft an AI revision for every non-satisfied finding. Default true. */
  generateSuggestedRevision?: boolean;
}

class Reviews {
  constructor(private http: Http) {}

  create(params: CreateReviewParams): Promise<Review> {
    return this.http.json<Review>("/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: params.document,
        protocol_document_id: params.protocol,
        ruleset: params.ruleset,
        generate_suggested_revision: params.generateSuggestedRevision ?? true,
      }),
    });
  }

  get(reviewId: string): Promise<Review> {
    return this.http.json<Review>(`/reviews/${reviewId}`);
  }

  list(): Promise<ReviewSummary[]> {
    return this.http.json<ReviewSummary[]>("/reviews");
  }

  /** Reviews run asynchronously — poll until complete (or failed). */
  async waitUntilComplete(
    reviewId: string,
    options: WaitOptions = {},
  ): Promise<Review> {
    const deadline = Date.now() + (options.timeoutMs ?? 600_000);
    for (;;) {
      const review = await this.get(reviewId);
      if (review.status === "complete") return review;
      if (review.status === "failed") {
        throw new CiteraError(`Review ${reviewId} failed`);
      }
      if (Date.now() > deadline) {
        throw new CiteraError(
          `Timed out waiting for review ${reviewId} to complete`,
        );
      }
      await sleep(options.pollMs ?? 2_000);
    }
  }

  /** Structured report with server-computed regulatory readiness. */
  report(reviewId: string): Promise<ReviewReport> {
    return this.http.json<ReviewReport>(`/reviews/${reviewId}/report`);
  }

  /** The same report rendered as reviewer-facing Markdown. */
  async reportMarkdown(reviewId: string): Promise<string> {
    const response = await this.http.request(
      `/reviews/${reviewId}/report?format=markdown`,
    );
    return response.text();
  }
}

class Rulesets {
  constructor(private http: Http) {}

  /** Every pack with its status: available | in_development | roadmap. */
  list(): Promise<RulesetInfo[]> {
    return this.http.json<RulesetInfo[]>("/rulesets");
  }

  get(rulesetId: string): Promise<Ruleset> {
    return this.http.json<Ruleset>(`/rulesets/${rulesetId}`);
  }
}

class Findings {
  constructor(private http: Http) {}

  /** Full finding dossier: requirement, evidence, analysis, audit status. */
  get(findingId: string): Promise<FindingDetail> {
    return this.http.json<FindingDetail>(`/findings/${findingId}`);
  }
}

export default class Citera {
  readonly documents: Documents;
  readonly reviews: Reviews;
  readonly rulesets: Rulesets;
  readonly findings: Findings;

  constructor(options: CiteraOptions = {}) {
    const env =
      typeof process !== "undefined"
        ? (process.env as Record<string, string | undefined>)
        : {};
    const http = new Http(
      (options.baseUrl ?? env.CITERA_BASE_URL ?? "http://localhost:8000").replace(
        /\/$/,
        "",
      ),
      options.apiKey ?? env.CITERA_API_KEY,
    );
    this.documents = new Documents(http);
    this.reviews = new Reviews(http);
    this.rulesets = new Rulesets(http);
    this.findings = new Findings(http);
  }
}
