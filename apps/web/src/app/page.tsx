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

function ViewRenderer({ view }: { view: ViewType }) {
  switch (view) {
    case "monitoring":
      return <MonitoringView />;
    case "lead-generation":
    default:
      return <LeadGenerationView />;
  }
}

export default function DashboardPage() {
  const [selectedView, setSelectedView] = useState<ViewType>("lead-generation");

  return (
    <SidebarProvider>
      <AppSidebar currentView={selectedView} onSelect={setSelectedView} />
      <SidebarInset>
        <Header view={selectedView} />
        <main className="flex-1 overflow-auto bg-background">
          <ViewRenderer view={selectedView} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
