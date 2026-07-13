"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const fallbackUser = {
  name: "LeadGen Operator",
  email: "operator@leadgen.local",
  imageUrl: "",
};

/**
 * Static identity chip. The old Account/Settings/Log out dropdown was removed —
 * those items had no handlers (no dead buttons policy). Reintroduce a menu when
 * Clerk auth is actually wired.
 */
export function NavUser() {
  const { open } = useSidebar();
  const user = fallbackUser;

  return (
    <SidebarMenu className="select-none">
      <SidebarMenuItem>
        <SidebarMenuButton className="pointer-events-none border border-sidebar-border bg-card">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.imageUrl} alt={user.name} />
            <AvatarFallback>LG</AvatarFallback>
          </Avatar>
          {open ? (
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          ) : null}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
