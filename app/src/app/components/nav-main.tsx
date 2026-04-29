"use client";

import { type LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { ViewType } from "@/app/types";

export interface NavBarItem {
  title: string;
  id: ViewType;
  icon: LucideIcon;
}

export function NavMain({
  items,
  currentView,
  onSelect,
  label = "Workspace",
}: {
  items: NavBarItem[];
  currentView: ViewType;
  onSelect: (view: ViewType) => void;
  label?: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              isActive={currentView === item.id}
              className="cursor-pointer"
              onClick={() => onSelect(item.id)}
            >
              <item.icon className="size-4 shrink-0" />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
