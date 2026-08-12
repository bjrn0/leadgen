"use client";

import { useEffect, useMemo, useState } from "react";
import { useMonitoring, useAddEntity, useUpdateEntity, useEntityJobs, type CreateEntityInput } from "@/lib/monitoring";
import { formatDateUTC } from "@/lib/format";
import {
  Bell,
  BriefcaseBusiness,
  Clock3,
  FileText,
  FolderPlus,
  Globe,
  Mail,
  Newspaper,
  Plus,
  Radio,
  Search,
  Sparkles,
  Target,
  UserPlus,
  Webhook,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pagination } from "@/app/components/pagination";
import { Hotness } from "@/app/components/hotness";
import type { MonitoringAccount } from "@/app/types";

const ACCOUNTS_PER_PAGE = 3;
const SIGNALS_PER_PAGE = 3;
const ROLES_PER_PAGE = 10;

function urgencyVariant(urgency: string) {
  if (urgency === "High") return "danger";
  if (urgency === "Medium") return "warning";
  return "secondary";
}

/** Toggleable notification channel — persists via PATCH /api/entities/[id]. */
function NotificationToggle({
  active,
  icon: Icon,
  label,
  onToggle,
}: {
  active: boolean;
  icon: typeof Mail;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex size-7 items-center justify-center rounded-md border transition ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-border bg-muted text-muted-foreground hover:bg-accent"
      }`}
      title={`${label}: ${active ? "on" : "off"} — click to toggle`}
      aria-label={`${label}: ${active ? "on" : "off"}`}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function sourceIcon(type: string) {
  if (type === "hiring") return BriefcaseBusiness;
  if (type === "product_launch" || type === "technology_change") return FileText;
  if (type === "funding" || type === "partnership" || type === "expansion") return Newspaper;
  return Radio;
}

export function MonitoringView({
  onViewOpportunities,
}: {
  onViewOpportunities?: (entityId: string) => void;
}) {
  const { data: accounts = [], isLoading, isError } = useMonitoring();
  const addEntity = useAddEntity();
  const updateEntity = useUpdateEntity();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [watchlistQuery, setWatchlistQuery] = useState("");
  const [accountsPage, setAccountsPage] = useState(1);
  const [signalsPage, setSignalsPage] = useState(1);
  const [rolesPage, setRolesPage] = useState(1);
  const [rolesQuery, setRolesQuery] = useState("");
  const [customSourceUrl, setCustomSourceUrl] = useState("");
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [addForm, setAddForm] = useState<{ type: "company" | "person"; name: string; tier: string; sources: string; email: string; webhook: string }>({ type: "company", name: "", tier: "Strategic", sources: "", email: "", webhook: "" });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAddAccountOpen(false);
      }
    }
    if (isAddAccountOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isAddAccountOpen]);

  // Name search over the watchlist. Filtering resets pagination so results
  // always start on page 1.
  const filteredAccounts = useMemo(() => {
    const q = watchlistQuery.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((account) => account.name.toLowerCase().includes(q));
  }, [accounts, watchlistQuery]);

  const accountsPageCount = Math.max(1, Math.ceil(filteredAccounts.length / ACCOUNTS_PER_PAGE));
  // Clamp during render: when a search shrinks the result set, `accountsPage`
  // may still point past the last page. Deriving the effective page here (rather
  // than resetting via an effect that runs after render) avoids a frame where
  // the slice is out of range and the list looks empty.
  const accountsPageSafe = Math.min(accountsPage, accountsPageCount);
  const visibleAccounts = useMemo(
    () => filteredAccounts.slice((accountsPageSafe - 1) * ACCOUNTS_PER_PAGE, accountsPageSafe * ACCOUNTS_PER_PAGE),
    [filteredAccounts, accountsPageSafe],
  );

  // The detail pane follows the search: if the selected company is filtered out,
  // show the first matching company instead, so the news below always reflect a
  // company that's actually visible in the list. When nothing matches it stays
  // null and the pane shows a placeholder (see below) rather than an unrelated
  // company's news.
  const selectedAccount: MonitoringAccount | null =
    filteredAccounts.find((account) => account.id === selectedAccountId) ??
    filteredAccounts[0] ??
    null;

  // Evidence timeline pagination resets when switching accounts.
  useEffect(() => {
    setSignalsPage(1);
    setRolesPage(1);
    setRolesQuery("");
    setCustomSourceUrl("");
  }, [selectedAccount?.id]);

  const signals = selectedAccount?.signals ?? [];
  const signalsPageCount = Math.max(1, Math.ceil(signals.length / SIGNALS_PER_PAGE));
  const visibleSignals = signals.slice(
    (signalsPage - 1) * SIGNALS_PER_PAGE,
    signalsPage * SIGNALS_PER_PAGE,
  );

  // Open roles for the selected account (job_postings). Only fetch when the view
  // count says there are any, so accounts with none skip the request entirely.
  const { data: openRoles = [], isLoading: rolesLoading } = useEntityJobs(
    selectedAccount?.id ?? null,
    (selectedAccount?.open_roles ?? 0) > 0,
  );
  // Title search over the open roles. Filtering resets pagination via the
  // clamped effective page below so results always start on page 1.
  const filteredRoles = useMemo(() => {
    const q = rolesQuery.trim().toLowerCase();
    if (!q) return openRoles;
    return openRoles.filter((role) => role.title?.toLowerCase().includes(q));
  }, [openRoles, rolesQuery]);
  const rolesPageCount = Math.max(1, Math.ceil(filteredRoles.length / ROLES_PER_PAGE));
  const rolesPageSafe = Math.min(rolesPage, rolesPageCount);
  const visibleRoles = filteredRoles.slice((rolesPageSafe - 1) * ROLES_PER_PAGE, rolesPageSafe * ROLES_PER_PAGE);

  async function handleAddAccount() {
    const input: CreateEntityInput = {
      type: addForm.type,
      name: addForm.name,
      tier: addForm.tier || undefined,
      seed_urls: addForm.sources ? addForm.sources.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      notifications: { email: !!addForm.email, webhook: !!addForm.webhook },
    };
    await addEntity.mutateAsync(input);
    toast.success("Account added to watchlist", { icon: <FolderPlus className="h-4 w-4" /> });
    setIsAddAccountOpen(false);
    setAddForm({ type: "company", name: "", tier: "Strategic", sources: "", email: "", webhook: "" });
  }

  function handleToggleNotification(account: MonitoringAccount, channel: "email" | "webhook") {
    updateEntity.mutate(
      { id: account.id, notifications: { [channel]: !account.notifications[channel] } },
      { onError: (err) => toast.error(err.message) },
    );
  }

  function handleAddCustomSource() {
    if (!selectedAccount) return;
    try {
      new URL(customSourceUrl);
    } catch {
      toast.error("Enter a valid URL (https://…)");
      return;
    }
    updateEntity.mutate(
      { id: selectedAccount.id, add_seed_url: customSourceUrl },
      {
        onSuccess: () => {
          toast.success("Source added — it will be crawled on the next cycle");
          setCustomSourceUrl("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading watchlist…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        Failed to load monitoring data.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[var(--brand-light)] p-3 text-[var(--brand)]">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Monitoring</h1>
            <p className="text-sm text-muted-foreground">
              Watchlisted accounts, recent signals, and the evidence behind them.
            </p>
          </div>
        </div>
        <Button onClick={() => setIsAddAccountOpen(true)}>
          <FolderPlus className="h-4 w-4" />
          Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <p>No accounts in watchlist yet.</p>
          <Button onClick={() => setIsAddAccountOpen(true)}>
            <FolderPlus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
      ) : null}

      {accounts.length > 0 ? (
      <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Watchlist</CardTitle>
                  <CardDescription>Named accounts under continuous delta tracking.</CardDescription>
                </div>
                <Badge variant="outline">{accounts.length} total</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by name…"
                  value={watchlistQuery}
                  onChange={(e) => setWatchlistQuery(e.target.value)}
                  aria-label="Search watchlist by name"
                />
              </div>
              <div className="space-y-3">
                {visibleAccounts.length === 0 ? (
                  <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                    No accounts match “{watchlistQuery}”.
                  </p>
                ) : null}
                {visibleAccounts.map((account) => (
                  // div+role, not <button>: the notification toggles inside are
                  // buttons themselves, and buttons cannot nest.
                  <div
                    key={account.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedAccountId(account.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedAccountId(account.id);
                      }
                    }}
                    className={`w-full cursor-pointer rounded-md border p-4 text-left transition hover:bg-accent ${
                      selectedAccount.id === account.id
                        ? "border-[var(--brand)] bg-[var(--brand-light)] shadow-sm ring-2 ring-[var(--brand-border)]"
                        : "bg-background"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{account.name}</span>
                          <Badge variant="outline">{account.tier}</Badge>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {account.sources} sources
                          {account.open_roles > 0 ? ` · ${account.open_roles} open roles` : ""} · latest{" "}
                          {formatDateUTC(account.latest)}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <NotificationToggle
                            active={account.notifications.email}
                            icon={Mail}
                            label="Email notifications"
                            onToggle={() => handleToggleNotification(account, "email")}
                          />
                          <NotificationToggle
                            active={account.notifications.webhook}
                            icon={Webhook}
                            label="Webhook"
                            onToggle={() => handleToggleNotification(account, "webhook")}
                          />
                        </div>
                      </div>
                      <Badge variant={urgencyVariant(account.urgency)}>{account.urgency}</Badge>
                    </div>
                    <div className="mt-4">
                      <Hotness tier={account.hotness} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={accountsPageSafe} pageCount={accountsPageCount} onChange={setAccountsPage} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {selectedAccount ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>{selectedAccount.name} Intelligence Hub</CardTitle>
                  <CardDescription>
                    {selectedAccount.tier} account · {selectedAccount.sources} tracked sources
                    {selectedAccount.open_roles > 0 ? ` · ${selectedAccount.open_roles} open roles` : ""} · latest signal {formatDateUTC(selectedAccount.latest, { withHour: true })}
                  </CardDescription>
                  <div className="mt-3 flex items-center gap-2">
                    <NotificationToggle
                      active={selectedAccount.notifications.email}
                      icon={Mail}
                      label="Email notifications"
                      onToggle={() => handleToggleNotification(selectedAccount, "email")}
                    />
                    <NotificationToggle
                      active={selectedAccount.notifications.webhook}
                      icon={Webhook}
                      label="Webhook"
                      onToggle={() => handleToggleNotification(selectedAccount, "webhook")}
                    />
                    <span className="text-xs text-muted-foreground">Notification routing — click to toggle</span>
                  </div>
                </div>
                {onViewOpportunities ? (
                  <Button onClick={() => onViewOpportunities(selectedAccount.id)}>
                    <Target className="h-4 w-4" />
                    View opportunities
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-md border bg-muted/40 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-[var(--brand)]" />
                    Latest Summary
                  </div>
                  <Badge variant={urgencyVariant(selectedAccount.urgency)}>{selectedAccount.urgency} urgency</Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{selectedAccount.summary ?? "No signals extracted yet — the next monitoring cycle will populate this."}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.6fr_0.4fr]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-[var(--brand)]" />
                    Evidence Timeline
                    <Badge variant="outline">{signals.length}</Badge>
                  </div>
                  {visibleSignals.length === 0 ? (
                    <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                      No signals yet for this account.
                    </p>
                  ) : null}
                  {visibleSignals.map((signal, idx) => {
                    const Icon = sourceIcon(signal.type ?? "");

                    return (
                      <div key={`${signal.time}-${idx}`} className="rounded-md border bg-background p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                            <div>
                              <div className="font-medium">{signal.title}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {signal.type} · {formatDateUTC(signal.time)}
                              </div>
                            </div>
                          </div>
                          <Badge variant={urgencyVariant(signal.urgency ?? "")}>{signal.urgency}</Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{signal.evidence}</p>
                      </div>
                    );
                  })}
                  <Pagination page={signalsPage} pageCount={signalsPageCount} onChange={setSignalsPage} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="h-4 w-4 text-[var(--brand)]" />
                    Custom Sources
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Add a URL to crawl for this account on every monitoring cycle.
                  </p>
                  {(() => {
                    const urlSources = (selectedAccount.source_urls ?? []).filter((s) => s.url);
                    return urlSources.length > 0 ? (
                      <ul className="space-y-1.5">
                        {urlSources.map((s) => (
                          <li key={s.id} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs">
                            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <a href={s.url ?? "#"} target="_blank" rel="noreferrer" className="truncate text-foreground hover:underline">
                              {s.url}
                            </a>
                            {!s.enabled ? <Badge variant="outline" className="ml-auto shrink-0">paused</Badge> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">No custom sources yet.</p>
                    );
                  })()}
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://company.com/newsroom"
                      value={customSourceUrl}
                      onChange={(e) => setCustomSourceUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddCustomSource();
                      }}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Add source"
                      disabled={!customSourceUrl || updateEntity.isPending}
                      onClick={handleAddCustomSource}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Open Roles — vacancies collected from careers surfaces (job_postings).
                  Distinct from the summarized `hiring` signal in the timeline: this
                  lists the individual open positions. Only rendered when there are any. */}
              {selectedAccount.open_roles > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BriefcaseBusiness className="h-4 w-4 text-[var(--brand)]" />
                    Open Roles
                    <Badge variant="outline">{selectedAccount.open_roles}</Badge>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Search roles by title…"
                      value={rolesQuery}
                      onChange={(e) => setRolesQuery(e.target.value)}
                      aria-label="Search open roles by title"
                    />
                  </div>
                  {rolesLoading && openRoles.length === 0 ? (
                    <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                      Loading open roles…
                    </p>
                  ) : visibleRoles.length === 0 ? (
                    <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                      No roles match “{rolesQuery}”.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {visibleRoles.map((role) => (
                        <li key={role.id} className="rounded-md border bg-background p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              {role.url ? (
                                <a href={role.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                                  {role.title}
                                </a>
                              ) : (
                                <span className="font-medium">{role.title}</span>
                              )}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {role.department ? <Badge variant="outline">{role.department}</Badge> : null}
                                {role.location ? <Badge variant="secondary">{role.location}</Badge> : null}
                                {role.remote ? <Badge variant="secondary">Remote</Badge> : null}
                                {role.employment_type ? <Badge variant="outline">{role.employment_type}</Badge> : null}
                              </div>
                            </div>
                            {role.posted_at ? (
                              <span className="shrink-0 text-xs text-muted-foreground">{formatDateUTC(role.posted_at)}</span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pagination page={rolesPageSafe} pageCount={rolesPageCount} onChange={setRolesPage} />
                </div>
              ) : null}
            </CardContent>
          </Card>
          ) : (
            <Card>
              <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <Search className="h-5 w-5" />
                <p>No company matches “{watchlistQuery}”.</p>
                <p className="text-sm">Adjust the search to see a company’s intelligence hub.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      ) : null}

      {isAddAccountOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={(event) => { if (event.target === event.currentTarget) setIsAddAccountOpen(false); }}>
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-auto shadow-xl">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FolderPlus className="h-4 w-4 text-[var(--brand)]" />
                    Add Account
                  </CardTitle>
                  <CardDescription>Create a monitored account with notification routing.</CardDescription>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setIsAddAccountOpen(false)} aria-label="Close add account modal">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-medium">Type</div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={addForm.type === "company" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAddForm((f) => ({ ...f, type: "company" }))}
                    className="flex items-center gap-2"
                  >
                    <BriefcaseBusiness className="h-4 w-4" />
                    Company
                  </Button>
                  <Button
                    type="button"
                    variant={addForm.type === "person" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAddForm((f) => ({ ...f, type: "person" }))}
                    className="flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Person
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  {addForm.type === "person" ? "Full Name" : "Account Name"}
                  <Input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder={addForm.type === "person" ? "Jane Smith" : "BMW Group"} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Tier
                  <Input value={addForm.tier} onChange={(e) => setAddForm((f) => ({ ...f, tier: e.target.value }))} placeholder="Strategic" />
                </label>
              </div>
              <label className="space-y-2 text-sm font-medium">
                Sources (comma-separated URLs)
                <Textarea value={addForm.sources} onChange={(e) => setAddForm((f) => ({ ...f, sources: e.target.value }))} placeholder="https://company.com/news, https://company.com/careers" />
              </label>
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium">Alert routing</div>
                <div className="rounded-md border bg-muted/40 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Bell className="h-4 w-4 text-[var(--brand)]" />
                    Notifications
                  </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[var(--brand)]" />
                      Email
                    </span>
                    <Input value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} placeholder="account-alerts@company.com" />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-[var(--brand)]" />
                      Webhook
                    </span>
                    <Input value={addForm.webhook} onChange={(e) => setAddForm((f) => ({ ...f, webhook: e.target.value }))} placeholder="https://hooks.example.com/watchlist" />
                  </label>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddAccountOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddAccount} disabled={!addForm.name || addEntity.isPending}>
                  <FolderPlus className="h-4 w-4" />
                  {addEntity.isPending ? "Adding…" : "Add Account"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
