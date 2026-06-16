import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {user && (
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="font-bold text-lg text-primary">Терминатор</span>
              <nav className="hidden md:flex gap-4">
                <Link href="/" className="text-sm font-medium hover:text-primary transition-colors data-[active=true]:text-primary" data-testid="link-home">Игра</Link>
                <Link href="/stats" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-stats">Моя статистика</Link>
                {user.role === "admin" && (
                  <>
                    <Link href="/admin/dictionary" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-admin-dict">Словарь</Link>
                    <Link href="/admin/logs" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-admin-logs">Логи</Link>
                  </>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground" data-testid="text-username">{user.username} ({user.role})</span>
              <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">Выход</Button>
            </div>
          </div>
        </header>
      )}
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
