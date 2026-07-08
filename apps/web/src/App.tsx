import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "react-router-dom";
import { apiGet, type HealthResponse } from "./api/client";

function HealthBadge() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<HealthResponse>("/health"),
    refetchInterval: 15_000,
  });

  const state = isLoading
    ? { label: "connecting…", classes: "bg-stone-100 text-stone-500" }
    : isError || data?.status !== "ok"
      ? { label: "api degraded", classes: "bg-amber-50 text-amber-700" }
      : { label: "api connected", classes: "bg-emerald-50 text-emerald-700" };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${state.classes}`}
    >
      {state.label}
    </span>
  );
}

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-white text-stone-900">
      <header className="flex shrink-0 items-center justify-between border-b border-stone-200 px-6 py-3">
        <Link to="/" className="block">
          <h1 className="text-sm font-semibold tracking-tight">Citera</h1>
          <p className="text-xs text-stone-500">Evidence Intelligence</p>
        </Link>
        <HealthBadge />
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
