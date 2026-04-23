"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  BellPlus,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleSlash2,
  Clock3,
  DatabaseZap,
  Filter,
  Mail,
  MailPlus,
  MapPinned,
  MessageSquareText,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users2,
  Webhook,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const leads = [
  {
    id: "harvestgrid",
    company: "HarvestGrid Robotics",
    location: "Des Moines, US",
    region: "US",
    segment: "Agriculture automation",
    vertical: "Agriculture tech",
    companySize: "50-500",
    buyerFocus: "VP Ops",
    score: 94,
    urgency: "High",
    status: "New",
    notifications: { email: true, webhook: true },
    summary:
      "Raised Series B, opened digital operations roles, and published a field-service modernization note within the last week.",
    happened:
      "A new funding event and transformation hire landed inside the same discovery window.",
    signals: [
      "Series B funding announced",
      "Hiring Head of Digital Transformation",
      "ERP modernization mentioned in product blog",
    ],
    contacts: [
      {
        name: "Mara Jensen",
        title: "VP Operations",
        channel: "Email + LinkedIn",
      },
      {
        name: "Cole Arnett",
        title: "Director, Field Systems",
        channel: "LinkedIn",
      },
    ],
    evidence: [
      {
        source: "Company newsroom",
        time: "Today 09:12",
        text: "Funding announcement references accelerated deployment across regional service teams.",
      },
      {
        source: "Careers page",
        time: "Today 07:48",
        text: "New transformation role owns ERP replacement, field tooling, and implementation partners.",
      },
      {
        source: "Product blog",
        time: "Yesterday 16:30",
        text: "Leadership framed legacy operations tooling as a blocker to deployment velocity.",
      },
    ],
  },
  {
    id: "freightloop",
    company: "FreightLoop AI",
    location: "Hamburg, DE",
    region: "DACH",
    segment: "Logistics intelligence",
    vertical: "Logistics",
    companySize: "50-500",
    buyerFocus: "VP Engineering",
    score: 88,
    urgency: "High",
    status: "Enriched",
    notifications: { email: true, webhook: false },
    summary:
      "Multiple signals around routing optimization, platform hiring, and enterprise customer onboarding pressure.",
    happened:
      "Platform hiring and customer-onboarding pressure appeared across jobs and founder media.",
    signals: [
      "Hiring platform engineering lead",
      "Customer onboarding doubled",
      "Podcast mention of integration bottlenecks",
    ],
    contacts: [
      {
        name: "Nina Vogt",
        title: "Chief Product Officer",
        channel: "Email",
      },
      {
        name: "Jonas Keller",
        title: "VP Engineering",
        channel: "LinkedIn",
      },
    ],
    evidence: [
      {
        source: "Job board",
        time: "Today 10:05",
        text: "Platform role emphasizes partner integrations, data pipelines, and delivery reliability.",
      },
      {
        source: "Founder interview",
        time: "Yesterday 18:20",
        text: "Founder cited onboarding throughput as the constraint on new enterprise deals.",
      },
      {
        source: "Company blog",
        time: "Yesterday 12:42",
        text: "Recent post announced expansion into German automotive supplier accounts.",
      },
    ],
  },
  {
    id: "voltware",
    company: "Voltware Supply",
    location: "Birmingham, UK",
    region: "UK",
    segment: "Industrial energy software",
    vertical: "Industrial software",
    companySize: "500-5000",
    buyerFocus: "COO",
    score: 81,
    urgency: "Medium",
    status: "CRM ready",
    notifications: { email: false, webhook: true },
    summary:
      "Expansion hiring and supplier portal updates point to near-term demand for delivery capacity.",
    happened:
      "Supplier portal changes and implementation hiring created a CRM-ready opportunity.",
    signals: [
      "Supplier portal relaunch",
      "Hiring implementation managers",
      "New partnership with EV battery vendor",
    ],
    contacts: [
      {
        name: "Priya Bains",
        title: "COO",
        channel: "Email + LinkedIn",
      },
      {
        name: "Thomas Reed",
        title: "Head of Delivery",
        channel: "Email",
      },
    ],
    evidence: [
      {
        source: "Partner announcement",
        time: "Today 08:33",
        text: "New battery vendor partnership includes supplier onboarding and workflow integration.",
      },
      {
        source: "Careers page",
        time: "Yesterday 14:18",
        text: "Implementation hiring cluster suggests new delivery commitments in the next quarter.",
      },
      {
        source: "Release notes",
        time: "2 days ago",
        text: "Supplier portal update added approval routing and audit-history language.",
      },
    ],
  },
  {
    id: "fieldpulse",
    company: "FieldPulse Systems",
    location: "Austin, US",
    region: "US",
    segment: "Field service SaaS",
    vertical: "Logistics",
    companySize: "50-500",
    buyerFocus: "COO",
    score: 76,
    urgency: "Medium",
    status: "New",
    notifications: { email: true, webhook: true },
    summary:
      "New implementation roles and customer-support hiring suggest pressure around field rollout quality.",
    happened:
      "Hiring clustered around rollout operations and implementation quality within the last two days.",
    signals: [
      "Hiring implementation operations lead",
      "Support team expansion",
      "Release note mentions field rollout defects",
    ],
    contacts: [
      { name: "Elena Brooks", title: "COO", channel: "Email" },
      { name: "Samir Patel", title: "Head of Implementation", channel: "LinkedIn" },
    ],
    evidence: [
      {
        source: "Careers page",
        time: "Today 06:55",
        text: "Implementation operations role owns customer rollout reliability and field adoption.",
      },
      {
        source: "Release notes",
        time: "Yesterday 13:02",
        text: "Release notes mention fixes for rollout defects and offline sync behavior.",
      },
      {
        source: "Support forum",
        time: "2 days ago",
        text: "Support hiring announcement points to growing field onboarding volume.",
      },
    ],
  },
  {
    id: "cropvector",
    company: "CropVector Analytics",
    location: "Munich, DE",
    region: "DACH",
    segment: "Agriculture analytics",
    vertical: "Agriculture tech",
    companySize: "50-500",
    buyerFocus: "CTO",
    score: 72,
    urgency: "Low",
    status: "Watch later",
    notifications: { email: false, webhook: false },
    summary:
      "Technical blog and senior backend hiring show mild platform modernization signals.",
    happened:
      "Engineering content suggests architecture work, but urgency is lower than active buying signals.",
    signals: [
      "Senior backend role opened",
      "Architecture blog mentions data platform consolidation",
      "New partner integration announced",
    ],
    contacts: [
      { name: "Lukas Weber", title: "CTO", channel: "LinkedIn" },
      { name: "Anika Hoff", title: "VP Product", channel: "Email" },
    ],
    evidence: [
      {
        source: "Engineering blog",
        time: "Yesterday 11:10",
        text: "Architecture post describes consolidation of ingestion services and customer reporting.",
      },
      {
        source: "Job board",
        time: "2 days ago",
        text: "Backend role calls out platform ownership, data pipelines, and integration reliability.",
      },
      {
        source: "Partner page",
        time: "3 days ago",
        text: "Partner integration announcement hints at continued ecosystem buildout.",
      },
    ],
  },
  {
    id: "routeforge",
    company: "RouteForge Mobility",
    location: "Rotterdam, NL",
    region: "EU",
    segment: "Mobility operations",
    vertical: "Logistics",
    companySize: "500-5000",
    buyerFocus: "VP Ops",
    score: 84,
    urgency: "High",
    status: "Enriched",
    notifications: { email: true, webhook: true },
    summary:
      "Expansion announcement and operations-platform hiring point to urgent delivery bandwidth needs.",
    happened:
      "European expansion, operations hiring, and platform ownership all appeared in a short window.",
    signals: [
      "New EU expansion announced",
      "Operations platform owner role opened",
      "Customer case study mentions routing constraints",
    ],
    contacts: [
      { name: "Iris de Vries", title: "VP Operations", channel: "Email + LinkedIn" },
      { name: "Marco Janssen", title: "Director of Platform", channel: "LinkedIn" },
    ],
    evidence: [
      {
        source: "Newsroom",
        time: "Today 08:22",
        text: "Expansion announcement describes delivery commitments across three new markets.",
      },
      {
        source: "Careers page",
        time: "Yesterday 16:44",
        text: "Operations platform owner role spans routing, vendor data, and internal tooling.",
      },
      {
        source: "Case study",
        time: "2 days ago",
        text: "Customer story names routing constraints as a top operational bottleneck.",
      },
    ],
  },
];

const verticalOptions = ["All", "Agriculture tech", "Logistics", "Industrial software"];
const regionOptions = ["All", "US", "DACH", "UK", "EU"];
const sizeOptions = ["All", "50-500", "500-5000"];
const buyerOptions = ["All", "COO", "VP Ops", "VP Engineering", "CTO"];

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

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={value === option ? "default" : "outline"}
            onClick={() => onChange(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function LeadGenerationView() {
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0].id);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [minFit, setMinFit] = useState(70);
  const [verticalFilter, setVerticalFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [sizeFilter, setSizeFilter] = useState("All");
  const [buyerFilter, setBuyerFilter] = useState("All");
  const [isIcpOpen, setIsIcpOpen] = useState(false);

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const matchesFit = lead.score >= minFit;
        const matchesVertical = verticalFilter === "All" || lead.vertical === verticalFilter;
        const matchesRegion = regionFilter === "All" || lead.region === regionFilter;
        const matchesSize = sizeFilter === "All" || lead.companySize === sizeFilter;
        const matchesBuyer = buyerFilter === "All" || lead.buyerFocus === buyerFilter;

        return matchesFit && matchesVertical && matchesRegion && matchesSize && matchesBuyer;
      }),
    [buyerFilter, minFit, regionFilter, sizeFilter, verticalFilter],
  );
  const visibleLeads = filteredLeads.slice(0, 5);

  const selectedLead =
    visibleLeads.find((lead) => lead.id === selectedLeadId) ??
    visibleLeads[0] ??
    leads[0];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[var(--brand-light)] p-3 text-[var(--brand)]">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Lead Generation</h1>
            <p className="text-sm text-muted-foreground">
              Discovery inbox on the left, selected lead workspace on the right.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsFiltersOpen(true)}>
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button onClick={() => setIsIcpOpen(true)}>
            <Plus className="h-4 w-4" />
            New ICP Rule
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Discovery Inbox
                    <Badge variant="brand">{visibleLeads.length} visible</Badge>
                  </CardTitle>
                  <CardDescription>New companies found by the active ICP rule.</CardDescription>
                </div>
                <Badge variant="outline">{filteredLeads.length} matching</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
                {visibleLeads.map((lead) => {
                  const isSelected = selectedLead.id === lead.id;

                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`w-full rounded-md border p-4 text-left transition hover:bg-accent ${
                        isSelected
                          ? "border-[var(--brand)] bg-[var(--brand-light)] shadow-sm ring-2 ring-[var(--brand-border)]"
                          : "bg-background"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{lead.company}</span>
                            {isSelected ? <Badge variant="brand">Selected</Badge> : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline">{lead.segment}</Badge>
                            <Badge variant={urgencyVariant(lead.urgency)}>{lead.urgency}</Badge>
                            <NotificationIcon
                              active={lead.notifications.email}
                              icon={Mail}
                              label={lead.notifications.email ? "Email notifications active" : "Email notifications inactive"}
                            />
                            <NotificationIcon
                              active={lead.notifications.webhook}
                              icon={Webhook}
                              label={lead.notifications.webhook ? "Webhook active" : "Webhook inactive"}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-[var(--brand)]">{lead.score}</div>
                          <div className="text-xs text-muted-foreground">fit</div>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{lead.summary}</p>
                      <div className="mt-4">
                        <Progress value={lead.score} />
                      </div>
                    </button>
                  );
                })}
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
                  <CardTitle>{selectedLead.company}</CardTitle>
                  <CardDescription>
                    {selectedLead.location} - {selectedLead.status} - {selectedLead.segment}
                  </CardDescription>
                  <div className="mt-3 flex items-center gap-2">
                    <NotificationIcon
                      active={selectedLead.notifications.email}
                      icon={Mail}
                      label={selectedLead.notifications.email ? "Email notifications active" : "Email notifications inactive"}
                    />
                    <NotificationIcon
                      active={selectedLead.notifications.webhook}
                      icon={Webhook}
                      label={selectedLead.notifications.webhook ? "Webhook active" : "Webhook inactive"}
                    />
                    <span className="text-xs text-muted-foreground">Notification routing for this discovery rule</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline">
                    <BellPlus className="h-4 w-4" />
                    Add to Watchlist
                  </Button>
                  <Button variant="outline">
                    <DatabaseZap className="h-4 w-4" />
                    Push to CRM
                  </Button>
                  <Button variant="outline">
                    <CircleSlash2 className="h-4 w-4" />
                    Suppress
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-md border bg-muted/40 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-[var(--brand)]" />
                    What Happened
                  </div>
                  <Badge variant={urgencyVariant(selectedLead.urgency)}>{selectedLead.urgency} urgency</Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{selectedLead.happened}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.62fr_0.38fr]">
                <div className="space-y-5">
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-[var(--brand)]" />
                      Key Signals
                    </div>
                    <div className="space-y-2">
                      {selectedLead.signals.map((signal) => (
                        <div key={signal} className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm">
                          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                          <span>{signal}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock3 className="h-4 w-4 text-[var(--brand)]" />
                      Evidence Timeline
                    </div>
                    <div className="space-y-3">
                      {selectedLead.evidence.map((item) => (
                        <div key={`${item.source}-${item.time}`} className="rounded-md border bg-background p-4 text-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-medium">{item.source}</span>
                            <span className="text-xs text-muted-foreground">{item.time}</span>
                          </div>
                          <p className="mt-2 leading-6 text-muted-foreground">{item.text}</p>
                          <Button className="mt-3" size="sm" variant="ghost">
                            <ArrowUpRight className="h-4 w-4" />
                            Open Evidence
                          </Button>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="space-y-5">
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Users2 className="h-4 w-4 text-[var(--brand)]" />
                      Enriched Contacts
                    </div>
                    <div className="space-y-3">
                      {selectedLead.contacts.map((contact) => (
                        <div key={contact.name} className="rounded-md border bg-background p-3">
                          <div className="font-medium">{contact.name}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{contact.title}</div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <Badge variant="secondary">{contact.channel}</Badge>
                            <Button size="sm" variant="outline">
                              <MailPlus className="h-4 w-4" />
                              Sequence
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4 text-[var(--brand)]" />
                      Batch Actions
                    </div>
                    <div className="space-y-2">
                      <Button className="w-full justify-start" variant="outline">
                        <CheckCircle2 className="h-4 w-4" />
                        Mark as Qualified
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        <BellPlus className="h-4 w-4" />
                        Watch Similar Companies
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        <DatabaseZap className="h-4 w-4" />
                        Export Selected Evidence
                      </Button>
                    </div>
                  </section>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isIcpOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-auto shadow-xl">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-[var(--brand)]" />
                    New ICP Rule
                  </CardTitle>
                  <CardDescription>Create a discovery model that feeds the inbox.</CardDescription>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setIsIcpOpen(false)} aria-label="Close ICP rule modal">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[var(--brand)]" />
                    Vertical
                  </span>
                  <Input defaultValue="Agriculture tech, logistics" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-[var(--brand)]" />
                    Region
                  </span>
                  <Input defaultValue="US, DACH, UK" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4 text-[var(--brand)]" />
                    Company Size
                  </span>
                  <Input defaultValue="50-500 employees" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-[var(--brand)]" />
                    Buyer Focus
                  </span>
                  <Input defaultValue="COO, VP Ops, CTO" />
                </label>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4 text-[var(--brand)]" />
                  Discovery Intent
                </label>
                <Textarea defaultValue="Find companies with public signals around operational bottlenecks, ERP modernization, delivery pressure, or transformation hiring in the last 14 days." />
              </div>
              <div className="mt-6 rounded-md border bg-muted/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <BellPlus className="h-4 w-4 text-[var(--brand)]" />
                  Notifications
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[var(--brand)]" />
                      Email
                    </span>
                    <Input defaultValue="sales-alerts@vention.dev" />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-[var(--brand)]" />
                      Webhook
                    </span>
                    <Input defaultValue="https://hooks.example.com/leadgen" />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setIsIcpOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsIcpOpen(false)}>
                  <Plus className="h-4 w-4" />
                  Create Rule
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isFiltersOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-auto shadow-xl">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-[var(--brand)]" />
                    Discovery Filters
                  </CardTitle>
                  <CardDescription>Filter the inbox by the same dimensions used in the ICP rule.</CardDescription>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setIsFiltersOpen(false)} aria-label="Close filters modal">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="space-y-2 text-sm font-medium">
                Minimum fit score
                <Input
                  min={0}
                  max={100}
                  type="number"
                  value={minFit}
                  onChange={(event) => setMinFit(Number(event.target.value))}
                />
              </label>
              <div className="space-y-4 rounded-md border bg-muted/30 p-4">
                <FilterGroup label="Vertical" options={verticalOptions} value={verticalFilter} onChange={setVerticalFilter} />
                <FilterGroup label="Region" options={regionOptions} value={regionFilter} onChange={setRegionFilter} />
                <FilterGroup label="Company size" options={sizeOptions} value={sizeFilter} onChange={setSizeFilter} />
                <FilterGroup label="Buyer focus" options={buyerOptions} value={buyerFilter} onChange={setBuyerFilter} />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMinFit(70);
                    setVerticalFilter("All");
                    setRegionFilter("All");
                    setSizeFilter("All");
                    setBuyerFilter("All");
                  }}
                >
                  Reset
                </Button>
                <Button onClick={() => setIsFiltersOpen(false)}>
                  <Filter className="h-4 w-4" />
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
