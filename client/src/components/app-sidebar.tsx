import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Upload,
  Users,
  Settings,
  CalendarDays,
  CalendarCheck,
  Coffee,
  Clock,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

const allMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["supervisor", "yonetim"] },
  { title: "Veri Yukle", url: "/upload", icon: Upload, roles: ["supervisor", "yonetim"] },
  { title: "Personeller", url: "/employees", icon: Users, roles: ["supervisor", "yonetim"] },
  { title: "Vardiya Plani", url: "/shifts", icon: Clock, roles: ["supervisor", "yonetim"] },
  { title: "Izin Yonetimi", url: "/leaves", icon: CalendarDays, roles: ["supervisor", "yonetim"] },
  { title: "Donemler", url: "/periods", icon: CalendarCheck, roles: ["supervisor", "yonetim"] },
  { title: "Ayarlar", url: "/settings", icon: Settings, roles: ["yonetim"] },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const menuItems = allMenuItems.filter(item => user && item.roles.includes(user.role));

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Coffee className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight" data-testid="text-app-title">DOSPRESSO</h2>
            <p className="text-xs text-muted-foreground">Personel Takip</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className="data-[active=true]:bg-sidebar-accent"
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "") || "dashboard"}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        {user && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{user.displayName[0]}</span>
              </div>
              <div>
                <p className="text-xs font-medium" data-testid="text-username">{user.displayName}</p>
                <Badge variant="outline" className="text-[10px] px-1 py-0" data-testid="text-role">
                  {user.role === "yonetim" ? "Yonetim" : "Supervisor"}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center">PDKS v3.0</p>
      </SidebarFooter>
    </Sidebar>
  );
}
