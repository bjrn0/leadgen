"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Cpu, Settings as SettingsIcon, SlidersHorizontal, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TagField } from "@/app/components/tag-field";
import { useSettings, useSaveSettings } from "@/lib/settings";
import { EMPTY_ICP, useIcp, useSaveIcp } from "@/lib/icp";
import type { IcpProfile, Settings } from "@/app/types";

function NumberField({
  label,
  hint,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <div>{label}</div>
      <Input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <p className="text-xs font-normal text-muted-foreground">{hint}</p> : null}
    </label>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`inline-flex h-6 w-11 items-center rounded-full transition ${on ? "bg-[var(--brand)]" : "bg-muted-foreground/30"}`}
      aria-label={label}
    >
      <span className={`inline-block size-5 rounded-full bg-white transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function SettingsView() {
  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const icpQuery = useIcp();
  const saveIcp = useSaveIcp();

  const [s, setS] = useState<Settings | null>(null);
  const [icp, setIcp] = useState<IcpProfile>(EMPTY_ICP);

  useEffect(() => {
    if (settingsQuery.data) setS(settingsQuery.data);
  }, [settingsQuery.data]);
  useEffect(() => {
    if (icpQuery.data) setIcp(icpQuery.data);
  }, [icpQuery.data]);

  const setField = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => (p ? { ...p, [k]: v } : p));
  const setIcpField = <K extends keyof IcpProfile>(k: K, v: IcpProfile[K]) => setIcp((p) => ({ ...p, [k]: v }));

  function handleSaveSettings() {
    if (!s) return;
    saveSettings.mutate(s, {
      onSuccess: () => toast.success("Settings saved"),
      onError: (err) => toast.error(err.message),
    });
  }

  function handleSaveIcp() {
    saveIcp.mutate(icp, {
      onSuccess: (res) =>
        toast.success(`ICP saved — re-ranked ${res.rescored.opportunities} opportunities, ${res.rescored.candidates} leads`),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[var(--brand-light)] p-3 text-[var(--brand)]">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Cadence, crawl engines, ranking thresholds, and your Ideal Customer Profile.
          </p>
        </div>
      </div>

      {/* Ideal Customer Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[var(--brand)]" />
            Ideal Customer Profile
          </CardTitle>
          <CardDescription>Defines what a good lead is. Saving re-ranks the whole queue by fit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            What you sell
            <Textarea
              value={icp.offering}
              onChange={(e) => setIcpField("offering", e.target.value)}
              placeholder="e.g. Modular industrial automation equipment & engineering services"
            />
          </label>
          <TagField label="Target verticals" placeholder="hardware manufacturing, chemical, automotive…" values={icp.verticals} onChange={(v) => setIcpField("verticals", v)} />
          <TagField label="Target buyer roles" placeholder="VP Engineering, Plant Manager…" values={icp.buyer_roles} onChange={(v) => setIcpField("buyer_roles", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TagField label="Company sizes" placeholder="200-1000, 1000-5000…" values={icp.company_sizes} onChange={(v) => setIcpField("company_sizes", v)} />
            <TagField label="Regions" placeholder="US, Canada, Europe…" values={icp.regions} onChange={(v) => setIcpField("regions", v)} />
          </div>
          <TagField label="Keywords" placeholder="factory automation, throughput…" values={icp.keywords} onChange={(v) => setIcpField("keywords", v)} />
          <TagField label="Technologies" placeholder="PLC, industrial robots…" values={icp.technologies} onChange={(v) => setIcpField("technologies", v)} />
          <TagField label="Pain themes you solve" placeholder="labor shortage, throughput bottleneck…" values={icp.pain_themes} onChange={(v) => setIcpField("pain_themes", v)} />
          <div className="flex justify-end border-t pt-4">
            <Button onClick={handleSaveIcp} disabled={saveIcp.isPending}>
              <Target className="h-4 w-4" />
              {saveIcp.isPending ? "Saving & re-ranking…" : "Save ICP & re-rank"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {s ? (
        <>
          {/* Cadence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--brand)]" />
                Cadence
              </CardTitle>
              <CardDescription>
                How often the background jobs run. The schedulers fire at their max rate and skip work that ran more recently than these intervals.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Monitoring interval (hours)"
                hint="Re-crawl each watched account at most this often."
                value={s.monitoring_interval_hours}
                min={1}
                max={168}
                onChange={(n) => setField("monitoring_interval_hours", n)}
              />
              <NumberField
                label="Discovery interval (hours)"
                hint="Run ICP web-search discovery at most this often."
                value={s.discovery_interval_hours}
                min={1}
                max={720}
                onChange={(n) => setField("discovery_interval_hours", n)}
              />
            </CardContent>
          </Card>

          {/* Engines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[var(--brand)]" />
                Engines
              </CardTitle>
              <CardDescription>Which crawl engines run and how many results each search pulls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Browserbase fallback</div>
                  <p className="text-xs text-muted-foreground">
                    When Firecrawl can&apos;t read a JS-heavy page, retry it with a headless browser. Requires Browserbase keys.
                  </p>
                </div>
                <Toggle on={s.browserbase_fallback} onToggle={() => setField("browserbase_fallback", !s.browserbase_fallback)} label="Browserbase fallback" />
              </div>
              <NumberField
                label="Search results per query"
                hint="How many web results each search query pulls (higher = broader + more cost)."
                value={s.search_results_per_query}
                min={1}
                max={20}
                onChange={(n) => setField("search_results_per_query", n)}
              />
            </CardContent>
          </Card>

          {/* Ranking thresholds */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[var(--brand)]" />
                Ranking thresholds
              </CardTitle>
              <CardDescription>Tune how strict the pipeline is about what becomes a lead or an insight.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Min ICP fit for a lead (0–100)"
                hint="Auto-discovered leads below this fit are skipped."
                value={s.min_lead_fit}
                min={0}
                max={100}
                onChange={(n) => setField("min_lead_fit", n)}
              />
              <NumberField
                label="Min insight confidence (0–1)"
                hint="Insights below this land as low-quality (hidden)."
                value={s.min_insight_confidence}
                step={0.05}
                min={0}
                max={1}
                onChange={(n) => setField("min_insight_confidence", n)}
              />
              <NumberField
                label="Dedup similarity (0–1)"
                hint="Findings at/above this cosine similarity are near-duplicates."
                value={s.dedup_similarity_threshold}
                step={0.01}
                min={0}
                max={1}
                onChange={(n) => setField("dedup_similarity_threshold", n)}
              />
              <NumberField
                label="Min classify score (0–1)"
                hint="Pages below this actionability skip extraction."
                value={s.min_classify_score}
                step={0.05}
                min={0}
                max={1}
                onChange={(n) => setField("min_classify_score", n)}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saveSettings.isPending}>
              <SettingsIcon className="h-4 w-4" />
              {saveSettings.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      )}
    </div>
  );
}
