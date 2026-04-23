"use client";

import { Bell, BrainCircuit, Search } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavMain, type NavBarItem } from "@/app/components/nav-main";
import { NavUser } from "@/app/components/nav-user";
import type { ViewType } from "@/app/types";

const items: NavBarItem[] = [
  {
    title: "Lead Generation",
    id: "lead-generation",
    icon: Search,
  },
  {
    title: "Monitoring",
    id: "monitoring",
    icon: Bell,
  },
];

export function AppSidebar({
  currentView,
  onSelect,
}: {
  currentView: ViewType;
  onSelect: (view: ViewType) => void;
}) {
  const { open } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-[var(--brand-light)] text-[var(--brand)]">
            <BrainCircuit className="h-5 w-5" />
          </div>
          {open ? (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">LeadGen</div>
              <div className="text-muted-foreground text-xs">GTM intelligence engine</div>
            </div>
          ) : null}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} currentView={currentView} onSelect={onSelect} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
