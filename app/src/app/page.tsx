"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/app/components/app-sidebar";
import type { ViewType } from "@/app/types";
import { LeadGenerationView } from "@/app/views/lead-generation-view";
import { MonitoringView } from "@/app/views/monitoring-view";

function Header({ view }: { view: ViewType }) {
  const title = view === "lead-generation" ? "Lead Generation" : "Monitoring";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center justify-between">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
    </header>
  );
}

export default function DashboardPage() {
  const [selectedView, setSelectedView] = useState<ViewType>("lead-generation");
  // Set when Monitoring's "View opportunities" jumps here; cleared via the filter chip.
  const [leadGenEntityFilter, setLeadGenEntityFilter] = useState<string | null>(null);

  function handleViewOpportunities(entityId: string) {
    setLeadGenEntityFilter(entityId);
    setSelectedView("lead-generation");
  }

  function handleSelectView(view: ViewType) {
    if (view === "lead-generation") setLeadGenEntityFilter(null);
    setSelectedView(view);
  }

  return (
    <SidebarProvider>
      <AppSidebar currentView={selectedView} onSelect={handleSelectView} />
      <SidebarInset>
        <Header view={selectedView} />
        <main className="flex-1 overflow-auto bg-background">
          {selectedView === "monitoring" ? (
            <MonitoringView onViewOpportunities={handleViewOpportunities} />
          ) : (
            <LeadGenerationView
              entityFilter={leadGenEntityFilter}
              onClearEntityFilter={() => setLeadGenEntityFilter(null)}
            />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
