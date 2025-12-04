"use client"

import { useMemo, Suspense, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Logo } from "~/components/logo"
import { AuthModal } from "~/components/auth-modal"
import { SignOutButton } from "~/components/sign-out-button"
import { ThemeToggle } from "~/components/theme-toggle"
import { Button } from "~/components/ui/button"
import { Navbar02, type Navbar02NavItem } from "~/components/ui/navbar-02"
import {
  NavigationMenuContent,
  NavigationMenuLink,
} from "~/components/ui/navigation-menu"
import { authQueryOptions } from "~/lib/auth/queries"
import { cn } from "~/lib/utils"

function NavbarActions() {
  const { data: user } = useSuspenseQuery(authQueryOptions())
  const [showAuthModal, setShowAuthModal] = useState(false)

  const openAuth = () => {
    setShowAuthModal(true)
  }

  return (
    <>
      {/* Secondary: Login (when not logged in) or Sign Out (when logged in) */}
      {user ? (
        <SignOutButton size="sm" />
      ) : (
        <Button variant="ghost" size="sm" onClick={openAuth}>
          Login
        </Button>
      )}
      
      {/* Primary CTA: AI Call your Friend */}
      <CreateCallButton />
      
      <ThemeToggle />
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        initialMode="login"
      />
    </>
  )
}

function CreateCallButton() {
  const { data: user } = useSuspenseQuery(authQueryOptions())
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleClick = () => {
    if (user) {
      // Navigate to create page (calls form)
      window.location.href = "/create"
    } else {
      // Open auth modal if not logged in
      setShowAuthModal(true)
    }
  }

  return (
    <>
      <Button
        onClick={handleClick}
        size="sm"
        className="bg-primary text-primary-foreground relative inline-flex w-fit items-center justify-center gap-x-1.5 overflow-hidden rounded-md px-4 h-9 shadow-sm"
      >
        AI Call your Friend
      </Button>
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        initialMode="login"
      />
    </>
  )
}

function CallersDropdownContent({ isMobile = false }: { isMobile?: boolean }) {
  const { data: callers = [] } = useQuery({
    queryKey: ["callers"],
    queryFn: async () => {
      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.VITE_BASE_URL || "http://localhost:3000"
      const res = await fetch(`${baseUrl}/api/callers`)
      if (!res.ok) throw new Error("Failed to fetch callers")
      return res.json() as Promise<
        Array<{
          id: string
          slug: string
          name: string
          tagline: string
          defaultImageUrl: string
          imageUrl?: string
          gender: string
        }>
      >
    },
    enabled: typeof window !== "undefined",
  })

  if (isMobile) {
    return (
      <>
        {callers.map((caller) => (
          <Link
            key={caller.id}
            to="/callers/$slug"
            params={{ slug: caller.slug }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer no-underline"
          >
            <img
              src={caller.imageUrl || caller.defaultImageUrl}
              alt={caller.name}
              className="h-10 w-10 rounded-full object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{caller.name}</div>
              {caller.tagline && (
                <p className="text-xs text-muted-foreground truncate">
                  {caller.tagline}
                </p>
              )}
            </div>
          </Link>
        ))}
      </>
    )
  }

  return (
    <div className="w-[600px] md:w-[900px] lg:w-[1200px] max-h-[80vh] overflow-y-auto scrollbar-hide">
      <div className="grid gap-3 p-4 pb-6 md:grid-cols-4">
      {callers.map((caller) => (
        <NavigationMenuLink key={caller.id} asChild>
          <Link
            to="/callers/$slug"
            params={{ slug: caller.slug }}
            className={cn(
              "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer"
            )}
          >
            <div className="flex items-start space-x-4">
              <img
                src={caller.imageUrl || caller.defaultImageUrl}
                alt={caller.name}
                className="h-12 w-12 rounded-full object-cover shrink-0"
              />
              <div className="space-y-1 flex-1 min-w-0">
                <div className="text-base font-medium leading-tight">
                  {caller.name}
                </div>
                {caller.tagline && (
                    <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                    {caller.tagline}
                  </p>
                )}
              </div>
            </div>
          </Link>
        </NavigationMenuLink>
      ))}
      </div>
    </div>
  )
}

export function Navbar() {
  const { data: user } = useSuspenseQuery(authQueryOptions());
  
  const navigationLinks = useMemo<Navbar02NavItem[]>(
    () => {
      const links: Navbar02NavItem[] = [
        {
          label: "Callers",
          submenu: true,
          type: "simple",
          customContent: <CallersDropdownContent isMobile={false} />,
          mobileContent: <CallersDropdownContent isMobile={true} />,
        },
        {
          href: "/how-it-works",
          label: "How it Works",
        },
      ];
      
      // Only show "Your Calls" if user is logged in
      if (user) {
        links.push({
          href: "/your-calls",
          label: "Your Calls",
        });
      }
      
      return links;
    },
    [user]
  )

  return (
    <Navbar02
      logo={
        <>
          <Logo variant="full" className="h-8 hidden md:block" />
          <Logo variant="icon" className="h-8 w-8 md:hidden" />
        </>
      }
      logoHref="/"
      navigationLinks={navigationLinks}
      rightContent={
        <Suspense fallback={<div className="h-9 w-32" />}>
          <NavbarActions />
        </Suspense>
      }
    />
  )
}
