"use client";

import { useEffect, useState } from "react";
import { useMonitoring, useAddEntity, type CreateEntityInput } from "@/lib/monitoring";
import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DatabaseZap,
  FileText,
  FolderPlus,
  Globe,
  Mail,
  Newspaper,
  Plus,
  Radio,
  Sparkles,
  UserPlus,
  Webhook,
  Workflow,
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

function urgencyVariant(urgency: string) {
  if (urgency === "High") return "danger";
  if (urgency === "Medium") return "warning";
  return "secondary";
}

function NotificationIcon({
  active,
  icon: Icon,
  label,
}: {
  active: boolean;
  icon: typeof Mail;
  label: string;
}) {
  return (
    <span
      className={`inline-flex size-7 items-center justify-center rounded-md border ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-border bg-muted text-muted-foreground"
      }`}
      title={label}
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function sourceIcon(type: string) {
  if (type === "Careers") return BriefcaseBusiness;
  if (type === "Newsroom" || type === "News") return Newspaper;
  if (type === "Release notes" || type === "Blog") return FileText;
  return Radio;
}

export function MonitoringView() {
  const { data: accounts = [], isLoading, isError } = useMonitoring();
  const addEntity = useAddEntity();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
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

  const visibleAccounts = accounts.slice(0, 5);
  const selectedAccount =
    visibleAccounts.find((account) => account.id === selectedAccountId) ??
    visibleAccounts[0] ??
    null;

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
              Watchlisted accounts, recent deltas, urgency alerts, and account-specific next actions.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <CalendarClock className="h-4 w-4" />
            Digest: 3h
          </Button>
          <Button onClick={() => setIsAddAccountOpen(true)}>
            <FolderPlus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
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

      {accounts.length > 0 && selectedAccount ? (
      <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Watchlist
                    <Badge variant="brand">{visibleAccounts.length} visible</Badge>
                  </CardTitle>
              <CardDescription>Named accounts under continuous delta tracking.</CardDescription>
                </div>
                <Badge variant="outline">{accounts.length} total</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
                {visibleAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`w-full rounded-md border p-4 text-left transition hover:bg-accent ${
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
                          {account.sources} sources - latest {account.latest}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <NotificationIcon
                            active={account.notifications.email}
                            icon={Mail}
                            label={account.notifications.email ? "Email notifications active" : "Email notifications inactive"}
                          />
                          <NotificationIcon
                            active={account.notifications.webhook}
                            icon={Webhook}
                            label={account.notifications.webhook ? "Webhook active" : "Webhook inactive"}
                          />
                        </div>
                      </div>
                      <Badge variant={urgencyVariant(account.urgency)}>{account.urgency}</Badge>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Signal strength</span>
                        <span>{account.score}</span>
                      </div>
                      <Progress value={account.score} />
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <Button size="sm" variant="outline">
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <div className="flex items-center gap-1">
                  <Badge variant="brand">1</Badge>
                  <Badge variant="outline">2</Badge>
                  <Badge variant="outline">3</Badge>
                </div>
                <Button size="sm" variant="outline">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>{selectedAccount.name} Intelligence Hub</CardTitle>
                  <CardDescription>
                    {selectedAccount.tier} account - {selectedAccount.sources} tracked sources - latest signal {selectedAccount.latest}
                  </CardDescription>
                  <div className="mt-3 flex items-center gap-2">
                    <NotificationIcon
                      active={selectedAccount.notifications.email}
                      icon={Mail}
                      label={selectedAccount.notifications.email ? "Email notifications active" : "Email notifications inactive"}
                    />
                    <NotificationIcon
                      active={selectedAccount.notifications.webhook}
                      icon={Webhook}
                      label={selectedAccount.notifications.webhook ? "Webhook active" : "Webhook inactive"}
                    />
                    <span className="text-xs text-muted-foreground">Notification routing for this account</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => toast.success("Task created", { icon: <UserPlus className="h-4 w-4" /> })}>
                    <UserPlus className="h-4 w-4" />
                    Create Task
                  </Button>
                  <Button variant="outline" onClick={() => toast.info("Email draft opened", { icon: <Mail className="h-4 w-4" /> })}>
                    <Mail className="h-4 w-4" />
                    Draft Email
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-md border bg-muted/40 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-[var(--brand)]" />
                    Last 3 Hours
                  </div>
                  <Badge variant={urgencyVariant(selectedAccount.urgency)}>{selectedAccount.urgency} urgency</Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{selectedAccount.summary}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.6fr_0.4fr]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-[var(--brand)]" />
                    Evidence Timeline
                  </div>
                  {selectedAccount.signals.map((signal) => {
                    const Icon = sourceIcon(signal.type ?? "");

                    return (
                      <div key={`${signal.type}-${signal.time}`} className="rounded-md border bg-background p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                            <div>
                              <div className="font-medium">{signal.title}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {signal.type} - {signal.time}
                              </div>
                            </div>
                          </div>
                          <Badge variant={urgencyVariant(signal.urgency ?? "")}>{signal.urgency}</Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{signal.evidence}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 text-[var(--brand)]" />
                      Alert Rules
                    </div>
                    <div className="rounded-md border bg-background p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Funding, executive hires, public pain points
                      </div>
                      <p className="mt-2 leading-6 text-muted-foreground">
                        Email and webhook notifications are enabled for high-urgency signals.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Globe className="h-4 w-4 text-[var(--brand)]" />
                      Custom Sources
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="https://company.com/news/rss" />
                      <Button size="icon" variant="outline" aria-label="Add source" onClick={() => toast.success("Source added", { icon: <Plus className="h-4 w-4" /> })}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Workflow className="h-4 w-4 text-[var(--brand)]" />
                  Next Best Actions
                </div>
                <div className="space-y-3">
                  <Textarea defaultValue={`Subject: ${selectedAccount.name} - delivery pressure and supplier execution\n\nNoticed the recent signals around execution capacity and platform coordination. Worth comparing notes on where external engineering support could remove delivery bottlenecks.`} />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => toast.success("Outreach started", { icon: <Mail className="h-4 w-4" /> })}>
                      <Mail className="h-4 w-4" />
                      Start Outreach
                    </Button>
                    <Button variant="outline" onClick={() => toast.success("Logged in CRM", { icon: <DatabaseZap className="h-4 w-4" /> })}>
                      <DatabaseZap className="h-4 w-4" />
                      Log in CRM
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
