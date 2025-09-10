import { 
  BarChart3, 
  FileText, 
  TestTube, 
  Shield, 
  Database,
  Home,
  Settings2
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const NavigationItems = () => {
  const { user } = useAuth();
  
  const mainNavigation = [
    { title: "Dashboard", url: "/", icon: Home },
    { title: "Prompt Library", url: "/prompts", icon: FileText },
    { title: "Testing Interface", url: "/testing", icon: TestTube },
    { title: "Safety Monitor", url: "/safety", icon: Shield },
    { title: "Results", url: "/results", icon: BarChart3 },
    { title: "Data Management", url: "/data", icon: Database },
  ];

  // Only show admin link to researchers/admins
  if (user?.role === 'researcher' || user?.role === 'admin') {
    mainNavigation.push({
      title: "Admin",
      url: "/admin",
      icon: Settings2
    });
  }

  return mainNavigation;
};

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Research Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NavigationItems().map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) =>
                        isActive 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "hover:bg-muted/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}