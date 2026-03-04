import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import UploadPage from "@/pages/upload";
import EmployeesPage from "@/pages/employees";
import EmployeeDetail from "@/pages/employee-detail";
import SettingsPage from "@/pages/settings";
import LeavesPage from "@/pages/leaves";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/upload" component={UploadPage} />
      <Route path="/employees" component={EmployeesPage} />
      <Route path="/employees/:enNo" component={EmployeeDetail} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/leaves" component={LeavesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center gap-2 p-2 border-b h-12 shrink-0">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <span className="text-xs text-muted-foreground font-mono">DOSPRESSO PDKS</span>
              </header>
              <main className="flex-1 overflow-hidden">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
