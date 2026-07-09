import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiDelete, apiGet, apiPost } from "../api/client";
import type { ApiKeyCreated, ApiKeyOut, UsageSummary } from "../api/types";
import { CodeTabs } from "../components/platform/CodeTabs";
import { timeAgo } from "../lib/format";
import {
  CURL_EXAMPLE,
  INSTALL_NPM,
  INSTALL_PIP,
  PY_EXAMPLE,
  TS_EXAMPLE,
} from "../lib/snippets";

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState<ApiKeyCreated | null>(null);

  const usage = useQuery({
    queryKey: ["usage"],
    queryFn: () => apiGet<UsageSummary>("/v1/usage/summary"),
  });
  const keys = useQuery({
    queryKey: ["keys"],
    queryFn: () => apiGet<ApiKeyOut[]>("/v1/keys"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["keys"] });
    queryClient.invalidateQueries({ queryKey: ["usage"] });
  };
  const createKey = useMutation({
    mutationFn: () => apiPost<ApiKeyCreated>("/v1/keys", { name: "Default key" }),
    onSuccess: (created) => {
      setRevealed(created);
      invalidate();
    },
  });
  const rotateKey = useMutation({
    mutationFn: (id: string) => apiPost<ApiKeyCreated>(`/v1/keys/${id}/rotate`, {}),
    onSuccess: (created) => {
      setRevealed(created);
      invalidate();
    },
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/keys/${id}`),
    onSuccess: invalidate,
  });

  const activeKeys = (keys.data ?? []).filter((k) => !k.revoked);
  const u = usage.data;
  const maxDaily = Math.max(1, ...(u?.requests.daily.map((d) => d.count) ?? [1]));

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 pb-16 pt-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">
          API Keys
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Authenticate the Citera SDK and REST API.{" "}
          <span className="text-stone-400">
            (Key enforcement on /v1 is rolling out — keys are fully managed
            today, required soon.)
          </span>
        </p>
      </div>

      {/* Plan strip */}
      <section className="grid grid-cols-4 gap-3">
        {[
          { label: "Plan", value: u?.plan ?? "—", sub: "credits renew monthly" },
          {
            label: "Credits",
            value: u ? `${u.credits.remaining.toLocaleString()}` : "—",
            sub: u ? `of ${u.credits.total.toLocaleString()}` : "",
          },
          {
            label: "API operations",
            value: u ? u.requests.total.toLocaleString() : "—",
            sub: `last ${u?.requests.period_days ?? 30} days`,
          },
          {
            label: "Rate limit",
            value: u ? `${u.rate_limit_rpm} rpm` : "—",
            sub: "per key",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-stone-200 bg-white p-3"
          >
            <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
              {card.label}
            </div>
            <div className="mt-1 text-lg font-semibold text-stone-900">
              {card.value}
            </div>
            <div className="text-[11px] text-stone-400">{card.sub}</div>
          </div>
        ))}
      </section>

      {/* Reveal-once banner */}
      {revealed && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="text-xs font-semibold text-amber-800">
            Copy your key now — it will not be shown again.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-white px-3 py-2 font-mono text-xs text-stone-800">
              {revealed.key}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(revealed.key)}
              className="rounded-md bg-stone-900 px-3 py-2 text-xs font-medium text-white"
            >
              Copy
            </button>
            <button
              onClick={() => setRevealed(null)}
              className="rounded-md px-2 py-2 text-xs text-stone-500 hover:bg-amber-100"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Keys */}
      <section className="rounded-2xl border border-stone-200 bg-white">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-800">Keys</h2>
          <button
            onClick={() => createKey.mutate()}
            disabled={createKey.isPending}
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            + Create key
          </button>
        </div>
        <ul className="divide-y divide-stone-100">
          {(keys.data ?? []).map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <code className="font-mono text-xs text-stone-800">
                  {k.prefix}
                  {"•".repeat(20)}
                </code>
                <div className="text-[11px] text-stone-400">
                  {k.name} · created {timeAgo(k.created_at)}
                  {k.revoked && (
                    <span className="ml-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-stone-500">
                      revoked
                    </span>
                  )}
                </div>
              </div>
              {!k.revoked && (
                <div className="flex shrink-0 gap-1 text-xs">
                  <button
                    onClick={() => rotateKey.mutate(k.id)}
                    className="rounded-md border border-stone-300 px-2.5 py-1 text-stone-600 hover:bg-stone-50"
                  >
                    Rotate
                  </button>
                  <button
                    onClick={() => revokeKey.mutate(k.id)}
                    className="rounded-md border border-red-200 px-2.5 py-1 text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
          {activeKeys.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-stone-400">
              No active keys — create one to start calling the API.
            </li>
          )}
        </ul>
      </section>

      {/* Usage + recent */}
      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="text-xs font-semibold text-stone-800">
            Usage — last {u?.requests.period_days ?? 30} days
          </h2>
          <div className="mt-3 flex h-20 items-end gap-1">
            {(u?.requests.daily ?? []).map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.count} operations`}
                className="min-w-1.5 flex-1 rounded-t bg-stone-800/80"
                style={{ height: `${Math.max(6, (d.count / maxDaily) * 100)}%` }}
              />
            ))}
            {(u?.requests.daily.length ?? 0) === 0 && (
              <div className="text-xs text-stone-400">No usage yet.</div>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="text-xs font-semibold text-stone-800">
            Recent operations
          </h2>
          <ul className="mt-2 space-y-1.5">
            {(u?.recent ?? []).map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between font-mono text-[11px] text-stone-600"
              >
                <span>{r.operation}</span>
                <span className="text-stone-400">{timeAgo(r.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Install + examples */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">Use the SDK</h2>
        <div className="grid grid-cols-2 gap-3">
          {[INSTALL_NPM, INSTALL_PIP].map((cmd) => (
            <code
              key={cmd}
              className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs text-stone-700"
            >
              $ {cmd}
            </code>
          ))}
        </div>
        <CodeTabs
          tabs={[
            { label: "curl", code: CURL_EXAMPLE },
            { label: "TypeScript", code: TS_EXAMPLE },
            { label: "Python", code: PY_EXAMPLE },
          ]}
        />
        <p className="text-[11px] text-stone-400">
          Supported models: <span className="font-medium">claude-sonnet-5</span>{" "}
          (default) · claude-opus-4-8 — configurable per request; every finding
          is span-verified regardless of model.
        </p>
      </section>
    </div>
  );
}
