import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Users, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import type { Employee } from "@shared/schema";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const { data: employees, isLoading } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const filtered = useMemo(() => {
    if (!employees) return [];
    return employees
      .filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        String(e.enNo).includes(search)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [employees, search]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-employees-title">Personeller</h1>
          <p className="text-sm text-muted-foreground">{employees?.length || 0} kayitli personel</p>
        </div>
        <Input
          placeholder="Personel ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          data-testid="input-search-employees"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-muted-foreground opacity-40 mb-4" />
          <p className="text-muted-foreground">
            {employees?.length === 0
              ? "Henuz personel kaydi yok. Veri yukleyerek personel kayitlari olusturun."
              : "Aramaniza uygun personel bulunamadi."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((e) => {
            const capitalName = e.name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
            return (
              <Link key={e.id} href={`/employees/${e.enNo}`}>
                <Card className="hover-elevate cursor-pointer" data-testid={`card-employee-${e.enNo}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{capitalName.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium">{capitalName}</p>
                        <p className="text-xs text-muted-foreground font-mono">Sicil: {e.enNo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.department && <Badge variant="secondary">{e.department}</Badge>}
                      <Badge variant={e.active ? "default" : "secondary"}>
                        {e.active ? "Aktif" : "Pasif"}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
