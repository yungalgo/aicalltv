import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { AuthModal } from "~/components/auth-modal";
import { SignOutButton } from "~/components/sign-out-button";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { authQueryOptions } from "~/lib/auth/queries";

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">AI Call TV</h1>
        </div>
        <div className="flex items-center gap-4">
          <Suspense fallback={<div className="h-9 w-20" />}>
            <AuthButtons />
          </Suspense>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function AuthButtons() {
  const { data: user } = useSuspenseQuery(authQueryOptions());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const openLogin = () => {
    setAuthMode("login");
    setShowAuthModal(true);
  };

  const openSignup = () => {
    setAuthMode("signup");
    setShowAuthModal(true);
  };

  return (
    <>
      {user ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <SignOutButton size="sm" />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={openLogin}
          >
            Log in
          </Button>
          <Button type="button" size="sm" onClick={openSignup}>
            Sign up
          </Button>
        </div>
      )}
      <AuthModal 
        open={showAuthModal} 
        onOpenChange={setShowAuthModal} 
        initialMode={authMode}
      />
    </>
  );
}

