import { Check } from "lucide-react";
import { useState } from "react";

export interface CodeTab {
  label: string;
  code: string;
}

export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(tabs[active].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900">
      <div className="flex items-center justify-between border-b border-stone-800 px-2 py-1.5">
        <div className="flex gap-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActive(i)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                i === active
                  ? "bg-stone-700 text-white"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          className="rounded-md px-2 py-1 text-[11px] text-stone-400 hover:text-stone-200"
        >
          {copied ? (
            <span className="inline-flex items-center gap-1">
              Copied <Check aria-hidden className="h-3 w-3" />
            </span>
          ) : (
            "Copy"
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] leading-5 text-stone-100">
        {tabs[active].code}
      </pre>
    </div>
  );
}
