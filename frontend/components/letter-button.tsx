"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorBox, Loading } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Letter = { markdown: string; source: string; data_layer: string };

// "Draft letter": a request for evidence or a warranty claim for one lead, never a legal notice.
// The text is a deterministic template from GET /api/findings/{id}/letter, so it works with no API key.
export function LetterButton({ findingId }: { findingId: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["letter", findingId],
    queryFn: () => api<Letter>(`/findings/${findingId}/letter`),
    enabled: open,
  });

  const download = () => {
    if (!q.data) return;
    const url = URL.createObjectURL(new Blob([q.data.markdown], { type: "text/markdown;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `letter-${findingId}.md` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4">
      <Button variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Hide letter" : "Draft letter"}
      </Button>
      {open ? (
        <div className="mt-2 rounded-xl border border-[#D5D6D0] bg-white p-3">
          {q.error ? <ErrorBox error={q.error} /> : !q.data ? <Loading label="Drafting…" /> : (
            <>
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[#16181D]">{q.data.markdown}</pre>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11.5px] text-[#454952]">Template letter · every figure copied from the evidence above</span>
                <Button onClick={download}>Download .md</Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
