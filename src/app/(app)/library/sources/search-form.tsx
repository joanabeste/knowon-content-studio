"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [value, setValue] = React.useState(initial);

  // Keep local state in sync when URL changes via other means
  React.useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const submit = (nextQ: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextQ) params.set("q", nextQ);
    else params.delete("q");
    params.delete("page"); // reset pagination on search change
    const qs = params.toString();
    router.push(qs ? `/library/sources?${qs}` : "/library/sources");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(value.trim());
  };

  const onClear = () => {
    setValue("");
    submit("");
  };

  return (
    <form onSubmit={onSubmit} className="relative w-full md:max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="In Titel und Inhalt suchen…"
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Suche zurücksetzen"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
