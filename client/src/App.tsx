import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { BranchProvider } from "@/hooks/use-branch";
import DashboardNew from "@/pages/dashboard-new";
import BranchPayroll from "@/pages/branch-payroll";
import EmployeesPage from "@/pages/employees";
import SettingsPage from "@/pages/settings";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardNew} />
      <Route path="/sube/:branchId" component={BranchPayroll} />
      <Route path="/employees" component={EmployeesPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <main className="h-screen w-full">
      <Router />
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BranchProvider>
            <AuthenticatedApp />
          </BranchProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
