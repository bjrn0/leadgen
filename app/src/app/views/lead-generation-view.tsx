"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ExternalLink,
  FolderPlus,
  Lightbulb,
  Mail,
  Sparkles,
  Target,
  UserPlus,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Pagination } from "@/app/components/pagination";
import { DraftModal } from "@/app/components/draft-modal";
import { formatDateUTC } from "@/lib/format";
import {
  useOpportunities,
  useOpportunity,
  useUpdateOpportunityStatus,
} from "@/lib/opportunities";
import { useAddCandidate, useDismissCandidate, useLeadCandidates } from "@/lib/leads";
import type { Opportunity, OpportunityStatus } from "@/app/types";

/**
 * Lead Generation — the action queue built from real monitoring output:
 *   Opportunities tab: insights converted into a ranked "who to contact, when,
 *   and why" queue (see pipeline/opportunities.ts for the score derivation).
 *   New Leads tab: entities the pipeline discovered alongside watched accounts,
 *   one click away from the watchlist.
 * The right column is the workspace for the selected opportunity: evidence,
 * suggested action, grounded AI outreach draft, and status transitions.
 */

const STATUS_FILTERS: { value: OpportunityStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "dismissed", label: "Dismissed" },
];

const OPPORTUNITIES_PER_PAGE = 5;
const CANDIDATES_PER_PAGE = 5;

function urgencyVariant(urgency: string | null) {
  if (urgency === "High") return "danger";
  if (urgency === "Medium") return "warning";
  return "secondary";
}

function statusVariant(status: OpportunityStatus) {
  if (status === "new") return "brand";
  if (status === "contacted") return "warning";
  if (status === "qualified") return "success";
  return "secondary";
}

function signalLabel(type: string | null): string {
  return (type ?? "signal").replaceAll("_", " ");
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function LeadGenerationView({
  entityFilter,
  onClearEntityFilter,
}: {
  entityFilter?: string | null;
  onClearEntityFilter?: () => void;
}) {
  const [tab, setTab] = useState<"opportunities" | "new-leads">("opportunities");
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | "all">("all");
  const [oppPage, setOppPage] = useState(1);
  const [candPage, setCandPage] = useState(1);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [isDraftOpen, setIsDraftOpen] = useState(false);

  const opportunities = useOpportunities({
    status: statusFilter,
    page: oppPage,
    pageSize: OPPORTUNITIES_PER_PAGE,
    entityId: entityFilter ?? undefined,
  });
  const candidates = useLeadCandidates({ page: candPage, pageSize: CANDIDATES_PER_PAGE });
  const updateStatus = useUpdateOpportunityStatus();
  const addCandidate = useAddCandidate();
  const dismissCandidate = useDismissCandidate();

  const oppList = useMemo(
    () => opportunities.data?.opportunities ?? [],
    [opportunities.data?.opportunities],
  );
  const oppTotal = opportunities.data?.total ?? 0;
  const oppPageCount = Math.max(1, Math.ceil(oppTotal / OPPORTUNITIES_PER_PAGE));

  const candList = candidates.data?.candidates ?? [];
  const candTotal = candidates.data?.total ?? 0;
  const candPageCount = Math.max(1, Math.ceil(candTotal / CANDIDATES_PER_PAGE));

  // Keep a valid selection as pages/filters change.
  const selectedOpportunity: Opportunity | null =
    oppList.find((o) => o.id === selectedOpportunityId) ?? oppList[0] ?? null;

  // Detail (with drafts) for the selected opportunity — powers the draft modal.
  const detail = useOpportunity(selectedOpportunity?.id ?? null);

  // Reset pagination when the filter changes.
  useEffect(() => {
    setOppPage(1);
  }, [statusFilter, entityFilter]);

  function handleStatusChange(opportunity: Opportunity, status: OpportunityStatus) {
    updateStatus.mutate(
      { id: opportunity.id, status },
      {
        onSuccess: () => toast.success(`Marked ${status}`),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  const filteredEntityName = entityFilter
    ? oppList[0]?.entities?.name ?? "selected account"
    : null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[var(--brand-light)] p-3 text-[var(--brand)]">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Lead Generation</h1>
            <p className="text-sm text-muted-foreground">
              Ranked opportunities from your monitored accounts — who to contact, when, and why.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => setStatusFilter(f.value)}>
              <Badge
                variant={statusFilter === f.value ? "brand" : "outline"}
                className="cursor-pointer"
              >
                {f.label}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {entityFilter ? (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="brand" className="gap-1">
            Filtered: {filteredEntityName}
            <button
              type="button"
              aria-label="Clear entity filter"
              onClick={() => onClearEntityFilter?.()}
              className="ml-1 hover:opacity-70"
            >
              <XCircle className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.42fr_0.58fr]">
        {/* Left column: queue tabs */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={tab === "opportunities" ? "default" : "outline"}
                  onClick={() => setTab("opportunities")}
                >
                  <Target className="h-4 w-4" />
                  Opportunities
                  <Badge variant={tab === "opportunities" ? "secondary" : "outline"}>{oppTotal}</Badge>
                </Button>
                <Button
                  size="sm"
                  variant={tab === "new-leads" ? "default" : "outline"}
                  onClick={() => setTab("new-leads")}
                >
                  <Sparkles className="h-4 w-4" />
                  New Leads
                  <Badge variant={tab === "new-leads" ? "secondary" : "outline"}>{candTotal}</Badge>
                </Button>
              </div>
              <CardDescription className="pt-2">
                {tab === "opportunities"
                  ? "Signals converted into a ranked outreach queue."
                  : "Entities discovered alongside your watchlist — add or dismiss."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tab === "opportunities" ? (
                <>
                  {opportunities.isLoading ? (
                    <p className="p-4 text-sm text-muted-foreground">Loading opportunities…</p>
                  ) : oppList.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                      <Lightbulb className="h-5 w-5" />
                      <p>No opportunities {statusFilter !== "all" ? `with status "${statusFilter}"` : "yet"}.</p>
                      <p>They are derived automatically from monitoring signals — add accounts or wait for the next cycle.</p>
                    </div>
                  ) : (
                    oppList.map((opp) => (
                      <button
                        key={opp.id}
                        type="button"
                        onClick={() => setSelectedOpportunityId(opp.id)}
                        className={`w-full rounded-md border p-4 text-left transition hover:bg-accent ${
                          selectedOpportunity?.id === opp.id
                            ? "border-[var(--brand)] bg-[var(--brand-light)] shadow-sm ring-2 ring-[var(--brand-border)]"
                            : "bg-background"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{opp.entities?.name ?? "Unknown"}</span>
                              <Badge variant="outline">{signalLabel(opp.signal_type)}</Badge>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{opp.why_now}</p>
                          </div>
                          <Badge variant={statusVariant(opp.status)}>{opp.status}</Badge>
                        </div>
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Opportunity score</span>
                            <span>
                              {opp.score} · {formatDateUTC(opp.created_at)}
                            </span>
                          </div>
                          <Progress value={opp.score} />
                        </div>
                      </button>
                    ))
                  )}
                  <Pagination page={oppPage} pageCount={oppPageCount} onChange={setOppPage} />
                </>
              ) : (
                <>
                  {candidates.isLoading ? (
                    <p className="p-4 text-sm text-muted-foreground">Loading candidates…</p>
                  ) : candList.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                      <Sparkles className="h-5 w-5" />
                      <p>No new leads discovered yet.</p>
                      <p>The pipeline proposes companies and people mentioned alongside your watched accounts.</p>
                    </div>
                  ) : (
                    candList.map((cand) => (
                      <div key={cand.id} className="rounded-md border bg-background p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {cand.type === "company" ? (
                                <Building2 className="h-4 w-4 text-[var(--brand)]" />
                              ) : (
                                <UserPlus className="h-4 w-4 text-[var(--brand)]" />
                              )}
                              <span className="font-semibold">{cand.name}</span>
                              <Badge variant="outline">{cand.type}</Badge>
                              {cand.relationship ? <Badge variant="secondary">{cand.relationship}</Badge> : null}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{cand.reason}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              via {cand.source_entity?.name ?? "watchlist"} · seen {cand.mention_count}× · last {formatDateUTC(cand.last_seen_at)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={addCandidate.isPending}
                            onClick={() =>
                              addCandidate.mutate(cand.id, {
                                onSuccess: () =>
                                  toast.success(`${cand.name} added to watchlist — first cycle started`, {
                                    icon: <FolderPlus className="h-4 w-4" />,
                                  }),
                                onError: (err) => toast.error(err.message),
                              })
                            }
                          >
                            <FolderPlus className="h-4 w-4" />
                            Add to watchlist
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={dismissCandidate.isPending}
                            onClick={() =>
                              dismissCandidate.mutate(cand.id, {
                                onSuccess: () => toast.success("Candidate dismissed"),
                                onError: (err) => toast.error(err.message),
                              })
                            }
                          >
                            <XCircle className="h-4 w-4" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  <Pagination page={candPage} pageCount={candPageCount} onChange={setCandPage} />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: opportunity workspace */}
        <div>
          {tab === "opportunities" && selectedOpportunity ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {selectedOpportunity.entities?.name}
                      <Badge variant="outline">{signalLabel(selectedOpportunity.signal_type)}</Badge>
                      <Badge variant={statusVariant(selectedOpportunity.status)}>
                        {selectedOpportunity.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {selectedOpportunity.insights?.headline ?? selectedOpportunity.why_now}
                    </CardDescription>
                  </div>
                  <Badge variant={urgencyVariant(selectedOpportunity.insights?.urgency ?? null)}>
                    {selectedOpportunity.insights?.urgency ?? "Low"} urgency
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-md border bg-muted/40 p-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Opportunity score — confidence × urgency × recency</span>
                    <span className="font-medium">{selectedOpportunity.score}/100</span>
                  </div>
                  <Progress value={selectedOpportunity.score} />
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {selectedOpportunity.insights?.summary ?? selectedOpportunity.why_now}
                  </p>
                </div>

                {selectedOpportunity.insights?.why_it_matters ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Lightbulb className="h-4 w-4 text-[var(--brand)]" />
                      Why it matters
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {selectedOpportunity.insights.why_it_matters}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BriefcaseBusiness className="h-4 w-4 text-[var(--brand)]" />
                    Suggested action
                  </div>
                  <p className="rounded-md border-l-2 border-[var(--brand)] bg-[var(--brand-light)] p-3 text-sm leading-6">
                    {selectedOpportunity.suggested_action}
                  </p>
                </div>

                {(selectedOpportunity.insights?.evidence?.length ?? 0) > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Evidence</div>
                    {selectedOpportunity.insights!.evidence.map((e, i) => (
                      <blockquote key={i} className="rounded-md border bg-background p-3 text-sm">
                        <p className="italic leading-6 text-muted-foreground">&ldquo;{e.excerpt}&rdquo;</p>
                        <a
                          href={e.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {hostnameOf(e.source_url)}
                          {e.published_at ? ` · ${formatDateUTC(e.published_at)}` : ""}
                        </a>
                      </blockquote>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button onClick={() => setIsDraftOpen(true)}>
                    <Mail className="h-4 w-4" />
                    {detail.data?.drafts?.length ? "Open draft" : "Draft outreach"}
                  </Button>
                  {selectedOpportunity.status !== "contacted" ? (
                    <Button
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => handleStatusChange(selectedOpportunity, "contacted")}
                    >
                      <Mail className="h-4 w-4" />
                      Mark contacted
                    </Button>
                  ) : null}
                  {selectedOpportunity.status !== "qualified" ? (
                    <Button
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => handleStatusChange(selectedOpportunity, "qualified")}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark qualified
                    </Button>
                  ) : null}
                  {selectedOpportunity.status !== "dismissed" ? (
                    <Button
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => handleStatusChange(selectedOpportunity, "dismissed")}
                    >
                      <XCircle className="h-4 w-4" />
                      Dismiss
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : tab === "opportunities" ? (
            <div className="flex h-64 items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
              Select an opportunity to see its evidence and actions.
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              <Sparkles className="h-5 w-5" />
              <p>New leads are entities the pipeline found mentioned alongside your watched accounts.</p>
              <p>Add one to the watchlist to start monitoring it — its first cycle runs immediately.</p>
            </div>
          )}
        </div>
      </div>

      {isDraftOpen && selectedOpportunity ? (
        <DraftModal
          opportunityId={selectedOpportunity.id}
          entityName={selectedOpportunity.entities?.name ?? "prospect"}
          latestDraft={detail.data?.drafts?.[0] ?? null}
          onClose={() => setIsDraftOpen(false)}
        />
      ) : null}
    </div>
  );
}
