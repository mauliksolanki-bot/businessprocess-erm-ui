"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Check, ChevronDown } from "lucide-react";

export type Option = { id: number; label: string };
type Props = {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  onFocus?: () => void;
  resetSignal?: number;
};

export default function SearchableMultiSelect({ options, value, onChange, placeholder = "Search...", className = "", label, onFocus, resetSignal }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLLabelElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q) || String(opt.id).includes(q));
  }, [options, query]);

  const filteredIds = useMemo(() => filtered.map((o) => String(o.id)), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => value.includes(id));
  const someFilteredSelected = filteredIds.some((id) => value.includes(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
    }
  }, [allFilteredSelected, someFilteredSelected]);

  // respond to external reset signal: clear internal search and close dropdown
  useEffect(() => {
    if (typeof resetSignal !== "number") return;
    setQuery("");
    setOpen(false);
  }, [resetSignal]);

  const selectedLabels = useMemo(() => options.filter((o) => value.includes(String(o.id))).map((o) => o.label), [options, value]);

  const displayText = selectedLabels.length === 0 ? "Select roles" : selectedLabels.length <= 2 ? selectedLabels.join(", ") : `${selectedLabels.slice(0, 2).join(", ")} + ${selectedLabels.length - 2} more`;

  const toggleOption = (id: string) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(Array.from(next));
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      onChange(value.filter((employeeId) => !filteredIds.includes(employeeId)));
      return;
    }
    const next = new Set(value);
    filteredIds.forEach((employeeId) => next.add(employeeId));
    onChange(Array.from(next));
  };

  return (
    <label ref={containerRef} className={`relative block ${className}`}>
      <span className="pointer-events-none absolute left-3 -top-2 z-10 bg-white px-1 text-xs text-zinc-500">{label}</span>
      <button
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-zinc-300 bg-white px-3 py-3 text-left text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (!next) setQuery("");
            return next;
          });
          onFocus?.();
        }}
        type="button"
      >
        <span className={`block min-w-0 flex-1 truncate ${selectedLabels.length === 0 ? "text-zinc-500" : "text-zinc-900"}`}>{displayText}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 max-h-72 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
          <div className="space-y-2 p-2">
            <input
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder={placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={onFocus}
            />

            <label
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${allFilteredSelected || someFilteredSelected ? "bg-cyan-50 text-cyan-900" : "hover:bg-zinc-50 text-zinc-800"}`}
            >
              <input
                ref={selectAllRef}
                checked={allFilteredSelected}
                className="h-5 w-5 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500"
                onChange={toggleSelectAll}
                type="checkbox"
              />
              <span className="min-w-0 font-medium">Select all</span>
            </label>

            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-500">No roles match your search.</div>
              ) : (
                filtered.map((opt) => {
                  const checked = value.includes(String(opt.id));
                  return (
                    <button
                      key={opt.id}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${checked ? "bg-cyan-50 text-cyan-900" : "hover:bg-zinc-50 text-zinc-800"}`}
                      onClick={() => toggleOption(String(opt.id))}
                      type="button"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? "border-cyan-600 bg-cyan-600 text-white" : "border-zinc-300 bg-white"}`}>
                          {checked ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{opt.label}</span>
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </label>
  );
}
