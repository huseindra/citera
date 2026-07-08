import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "react-router-dom";
import { apiGet, type HealthResponse } from "./api/client";

function HealthDot() {
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<HealthResponse>("/health"),
    refetchInterval: 20_000,
  });
  const ok = !isError && data?.status === "ok";
  return (
    <span
      title={ok ? "API connected" : "API unreachable or degraded"}
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        ok ? "bg-emerald-500" : "bg-amber-500"
      }`}
    />
  );
}

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-stone-50/40 text-stone-900 antialiased">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-stone-200/80 bg-white/80 px-4 backdrop-blur">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-sm font-bold tracking-tight">Citera</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            Evidence Intelligence
          </span>
        </Link>
        <HealthDot />
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
