"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Mail, RefreshCw, Save, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateDraft, useSaveDraft } from "@/lib/opportunities";
import type { Draft } from "@/app/types";

/**
 * Outreach-draft workspace for one opportunity. Opens on the latest draft (or
 * generates one if none exists), lets the user edit subject/body, save,
 * regenerate, and copy. A grounding badge warns when the model's claimed facts
 * couldn't be verified against the insight evidence.
 */
export function DraftModal({
  opportunityId,
  entityName,
  latestDraft,
  onClose,
}: {
  opportunityId: string;
  entityName: string;
  latestDraft: Draft | null;
  onClose: () => void;
}) {
  const generate = useGenerateDraft();
  const save = useSaveDraft();

  const [draft, setDraft] = useState<Draft | null>(latestDraft);
  const [subject, setSubject] = useState(latestDraft?.subject ?? "");
  const [body, setBody] = useState(latestDraft?.body ?? "");
  const [copied, setCopied] = useState(false);

  const generating = generate.isPending;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // No draft yet → generate one on open.
  useEffect(() => {
    if (!draft && !generating && !generate.isError) {
      generate.mutate(opportunityId, {
        onSuccess: (d) => {
          setDraft(d);
          setSubject(d.subject);
          setBody(d.body);
        },
        onError: (err) => toast.error(err.message),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRegenerate() {
    generate.mutate(opportunityId, {
      onSuccess: (d) => {
        setDraft(d);
        setSubject(d.subject);
        setBody(d.body);
        toast.success("New draft generated");
      },
      onError: (err) => toast.error(err.message),
    });
  }

  function handleSave() {
    if (!draft) return;
    save.mutate(
      { id: draft.id, subject, body },
      {
        onSuccess: (d) => {
          setDraft(d);
          toast.success("Draft saved");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Copied to clipboard");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-auto shadow-xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[var(--brand)]" />
                Outreach draft — {entityName}
              </CardTitle>
              <CardDescription>
                Generated from the opportunity&apos;s evidence. Edit freely before sending.
              </CardDescription>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close draft modal">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {generating && !draft ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <p className="text-sm">Writing a grounded draft… (takes ~10–20s)</p>
            </div>
          ) : draft ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {draft.grounded ? (
                  <Badge variant="success" className="gap-1">
                    <ShieldCheck className="h-3 w-3" /> grounded in evidence
                  </Badge>
                ) : (
                  <Badge variant="warning" className="gap-1">
                    <ShieldAlert className="h-3 w-3" /> unverified claims — review carefully
                  </Badge>
                )}
                {draft.edited ? <Badge variant="outline">edited</Badge> : null}
              </div>

              <label className="block space-y-2 text-sm font-medium">
                Subject
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Body
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[220px] leading-6"
                />
              </label>

              {draft.facts_used.length > 0 ? (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium">
                    Facts used ({draft.facts_used.length})
                  </summary>
                  <ul className="mt-2 space-y-1 border-l pl-3">
                    {draft.facts_used.map((f, i) => (
                      <li key={i}>&ldquo;{f}&rdquo;</li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={handleRegenerate} disabled={generating}>
                  <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
                  {generating ? "Generating…" : "Regenerate"}
                </Button>
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={save.isPending || (subject === draft.subject && body === draft.body)}
                >
                  <Save className="h-4 w-4" />
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
              <p className="text-sm">Draft generation failed.</p>
              <Button variant="outline" onClick={handleRegenerate}>
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
