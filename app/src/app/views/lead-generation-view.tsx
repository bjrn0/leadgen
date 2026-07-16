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
  Search,
  Sparkles,
  Target,
  UserPlus,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/app/components/pagination";
import { DraftModal } from "@/app/components/draft-modal";
import { Hotness } from "@/app/components/hotness";
import { Input } from "@/components/ui/input";
import { formatDateUTC } from "@/lib/format";
import { icpIsMeaningful, useIcp } from "@/lib/icp";
import {
  useOpportunities,
  useOpportunity,
  useUpdateOpportunityStatus,
} from "@/lib/opportunities";
import { useAddCandidate, useDismissCandidate, useLeadCandidates, useSearchLeads } from "@/lib/leads";
import type { LeadCandidate, Opportunity, OpportunityStatus } from "@/app/types";

/**
 * Lead Generation — the action queue anchored on the Ideal Customer Profile.
 *   Opportunities tab: act NOW on accounts you already monitor — monitoring
 *   signals turned into a queue, ranked by ICP fit (hotness meter).
 *   New Leads tab: NEW entities to START monitoring — found via the web-search box
 *   (type a query → ICP-scored results) or mentioned alongside watched accounts. "Add to monitoring"
 *   promotes one to the watchlist and it gets its own opportunities.
 * The right column is a workspace for the selected opportunity OR the selected
 * new-lead's provenance/evidence detail.
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
  onEditIcp,
}: {
  entityFilter?: string | null;
  onClearEntityFilter?: () => void;
  onEditIcp?: () => void;
}) {
  const [tab, setTab] = useState<"opportunities" | "new-leads">("opportunities");
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | "all">("all");
  const [oppPage, setOppPage] = useState(1);
  const [candPage, setCandPage] = useState(1);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDraftOpen, setIsDraftOpen] = useState(false);

  const icpQuery = useIcp();
  const icp = icpQuery.data ?? null;
  const hasIcp = icpIsMeaningful(icp);

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
  const search = useSearchLeads();

  function handleSearch() {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    search.mutate(q, {
      onSuccess: (r) =>
        toast.success(
          r.found.length > 0
            ? `Found ${r.found.length} lead${r.found.length === 1 ? "" : "s"} for "${r.query}"`
            : `No new leads found for "${r.query}"`,
        ),
      onError: (err) => toast.error(err.message),
    });
  }

  const oppList = useMemo(
    () => opportunities.data?.opportunities ?? [],
    [opportunities.data?.opportunities],
  );
  const oppTotal = opportunities.data?.total ?? 0;
  const oppPageCount = Math.max(1, Math.ceil(oppTotal / OPPORTUNITIES_PER_PAGE));

  const candList = candidates.data?.candidates ?? [];
  const candTotal = candidates.data?.total ?? 0;
  const candPageCount = Math.max(1, Math.ceil(candTotal / CANDIDATES_PER_PAGE));

  // Keep valid selections as pages/filters change.
  const selectedOpportunity: Opportunity | null =
    oppList.find((o) => o.id === selectedOpportunityId) ?? oppList[0] ?? null;
  const selectedCandidate: LeadCandidate | null =
    candList.find((c) => c.id === selectedCandidateId) ?? null;

  // Detail (with drafts) for the selected opportunity — powers the draft modal.
  const detail = useOpportunity(selectedOpportunity?.id ?? null);

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

  function handleAddCandidate(cand: LeadCandidate) {
    setPendingCandidateId(cand.id);
    addCandidate.mutate(cand.id, {
      onSuccess: () =>
        toast.success(`${cand.name} added to monitoring — first cycle started`, {
          icon: <FolderPlus className="h-4 w-4" />,
        }),
      onError: (err) => toast.error(err.message),
      onSettled: () => setPendingCandidateId(null),
    });
  }

  function handleDismissCandidate(cand: LeadCandidate) {
    setPendingCandidateId(cand.id);
    dismissCandidate.mutate(cand.id, {
      onSuccess: () => toast.success("Candidate dismissed"),
      onError: (err) => toast.error(err.message),
      onSettled: () => setPendingCandidateId(null),
    });
  }

  const icpSummary = hasIcp
    ? [icp!.verticals.slice(0, 3).join(", "), icp!.buyer_roles.slice(0, 2).join(" / ")]
        .filter(Boolean)
        .join(" · ")
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
              Ranked by fit to your Ideal Customer Profile — who to contact, when, and why.
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

      {/* ICP summary bar — the anchor that drives all ranking. */}
      {hasIcp ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 shrink-0 text-[var(--brand)]" />
            <span className="text-muted-foreground">Targeting:</span>
            <span className="font-medium">{icpSummary || "your ICP"}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => onEditIcp?.()}>
            Edit ICP
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed bg-muted/30 p-6 text-center">
          <Target className="h-6 w-6 text-[var(--brand)]" />
          <div>
            <p className="font-medium">Define your Ideal Customer Profile to rank leads</p>
            <p className="text-sm text-muted-foreground">
              Without it, opportunities are ranked by raw signal only — set what you sell and who you target so the queue surfaces the leads that actually fit.
            </p>
          </div>
          <Button onClick={() => onEditIcp?.()}>
            <Target className="h-4 w-4" />
            Set up ICP
          </Button>
        </div>
      )}

      {entityFilter ? (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="brand" className="gap-1">
            Filtered: {selectedOpportunity?.entities?.name ?? "selected account"}
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
              <div className="flex flex-wrap items-center justify-between gap-2">
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
              </div>
              {/* Real search: type a query, search the web, get ICP-scored leads. */}
              {tab === "new-leads" && hasIcp ? (
                <div className="flex gap-2 pt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Search the web for leads — e.g. “chemical manufacturers Texas”"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSearch();
                      }}
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={search.isPending || searchQuery.trim().length < 2}>
                    {search.isPending ? "Searching…" : "Search"}
                  </Button>
                </div>
              ) : null}
              <CardDescription className="pt-2">
                {tab === "opportunities"
                  ? "Act now on accounts you already monitor."
                  : "New entities to start monitoring — from web search or mentioned alongside watched accounts. Not yet tracked."}
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
                      <p>They&apos;re derived automatically from monitoring signals — add accounts or wait for the next cycle.</p>
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
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <Hotness tier={opp.hotness} icpFit={opp.icp_fit} signalScore={opp.score} size="sm" />
                          <span className="text-xs text-muted-foreground">{formatDateUTC(opp.created_at)}</span>
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
                    candList.map((cand) => {
                      const rowPending = pendingCandidateId === cand.id;
                      return (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => setSelectedCandidateId(cand.id)}
                          className={`block w-full rounded-md border p-4 text-left transition hover:bg-accent ${
                            selectedCandidate?.id === cand.id
                              ? "border-[var(--brand)] bg-[var(--brand-light)] shadow-sm ring-2 ring-[var(--brand-border)]"
                              : "bg-background"
                          }`}
                        >
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
                                <Badge variant="secondary">
                                  {cand.discovery_source === "icp_search" ? "ICP search" : cand.relationship ?? "mention"}
                                </Badge>
                              </div>
                              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{cand.reason}</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <Hotness tier={cand.hotness} icpFit={cand.icp_fit} size="sm" />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              role="button"
                              tabIndex={0}
                              aria-disabled={rowPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!rowPending) handleAddCandidate(cand);
                              }}
                              onKeyDown={(e) => {
                                if ((e.key === "Enter" || e.key === " ") && !rowPending) {
                                  e.preventDefault();
                                  handleAddCandidate(cand);
                                }
                              }}
                              className={`inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 text-sm font-medium text-white transition ${rowPending ? "pointer-events-none opacity-50" : "hover:bg-[var(--brand-hover)]"}`}
                            >
                              <FolderPlus className="h-4 w-4" />
                              Add to monitoring
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              aria-disabled={rowPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!rowPending) handleDismissCandidate(cand);
                              }}
                              onKeyDown={(e) => {
                                if ((e.key === "Enter" || e.key === " ") && !rowPending) {
                                  e.preventDefault();
                                  handleDismissCandidate(cand);
                                }
                              }}
                              className={`inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition ${rowPending ? "pointer-events-none opacity-50" : "hover:bg-accent"}`}
                            >
                              <XCircle className="h-4 w-4" />
                              Dismiss
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                  <Pagination page={candPage} pageCount={candPageCount} onChange={setCandPage} />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: opportunity workspace OR new-lead detail */}
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
                  <div className="flex items-center justify-between gap-3">
                    <Hotness
                      tier={selectedOpportunity.hotness}
                      icpFit={selectedOpportunity.icp_fit}
                      signalScore={selectedOpportunity.score}
                    />
                  </div>
                  {selectedOpportunity.icp_fit_reason ? (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      <span className="font-medium text-foreground">Why it fits: </span>
                      {selectedOpportunity.icp_fit_reason}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {selectedOpportunity.insights?.summary ?? selectedOpportunity.why_now}
                    </p>
                  )}
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
                  <p className="rounded-md bg-[var(--brand-light)] p-3 text-sm leading-6 ring-1 ring-[var(--brand-border)]">
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
          ) : tab === "new-leads" && selectedCandidate ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {selectedCandidate.name}
                      <Badge variant="outline">{selectedCandidate.type}</Badge>
                      <Badge variant="secondary">
                        {selectedCandidate.discovery_source === "icp_search"
                          ? "ICP search"
                          : selectedCandidate.relationship ?? "mention"}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {selectedCandidate.discovery_source === "icp_search"
                        ? "Found by ICP web search — a company matching your Ideal Customer Profile."
                        : `Discovered ${selectedCandidate.type === "company" ? "as a company" : "as a person"} named${
                            selectedCandidate.relationship ? ` as ${selectedCandidate.relationship}` : ""
                          } of ${selectedCandidate.source_entity?.name ?? "a watched account"}.`}
                    </CardDescription>
                  </div>
                  <Hotness tier={selectedCandidate.hotness} icpFit={selectedCandidate.icp_fit} />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {selectedCandidate.icp_fit_reason ? (
                  <div className="rounded-md border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                    <span className="font-medium text-foreground">ICP fit: </span>
                    {selectedCandidate.icp_fit_reason}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-[var(--brand)]" />
                    How it was found
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {selectedCandidate.reason ??
                      (selectedCandidate.discovery_source === "icp_search"
                        ? "Surfaced by ICP web search."
                        : "Mentioned alongside a watched account.")}{" "}
                    Seen {selectedCandidate.mention_count}× · last {formatDateUTC(selectedCandidate.last_seen_at)}.
                  </p>
                </div>

                {selectedCandidate.evidence.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Evidence</div>
                    {selectedCandidate.evidence.map((e, i) => (
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
                        </a>
                      </blockquote>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button
                    disabled={pendingCandidateId === selectedCandidate.id}
                    onClick={() => handleAddCandidate(selectedCandidate)}
                  >
                    <FolderPlus className="h-4 w-4" />
                    Add to monitoring
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pendingCandidateId === selectedCandidate.id}
                    onClick={() => handleDismissCandidate(selectedCandidate)}
                  >
                    <XCircle className="h-4 w-4" />
                    Dismiss
                  </Button>
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
              <p>Select one to see where it came from, or add it to monitoring to start tracking it.</p>
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
