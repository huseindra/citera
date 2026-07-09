import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
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
      title={ok ? "Platform operational" : "Platform degraded"}
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        ok ? "bg-green-500" : "bg-amber-500"
      }`}
    />
  );
}

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/playground", label: "Playground", end: false },
  { to: "/keys", label: "API Keys", end: false },
  { to: "/reference", label: "API Reference", end: false },
];

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-stone-50 text-stone-900 antialiased">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-stone-200/80 bg-white/80 px-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-tight">Citera</span>
            <span className="hidden text-[10px] font-medium uppercase tracking-widest text-stone-400 sm:block">
              Clinical Regulatory Intelligence
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-2.5 py-1 text-xs font-medium ${
                    isActive
                      ? "bg-blue-100/60 text-blue-700"
                      : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/huseindra/citera"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            GitHub <ArrowUpRight aria-hidden className="h-3 w-3" />
          </a>
          <HealthDot />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
