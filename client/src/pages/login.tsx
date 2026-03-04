import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Coffee, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError("Kullanici adi veya sifre hatali");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4" data-testid="card-login">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Coffee className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">DOSPRESSO</CardTitle>
          <p className="text-muted-foreground text-sm">Personel Takip Sistemi</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Kullanici Adi</Label>
              <Input
                id="username"
                data-testid="input-username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="supervisor veya yonetim"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Sifre</Label>
              <Input
                id="password"
                type="password"
                data-testid="input-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="****"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="text-login-error">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Giris Yap
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
