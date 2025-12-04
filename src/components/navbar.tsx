"use client"

import { useMemo, useState, useEffect } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Logo } from "~/components/logo"
import { AuthModal } from "~/components/auth-modal"
import { Button } from "~/components/ui/button"
import { Navbar02, type Navbar02NavItem } from "~/components/ui/navbar-02"
import { NavigationMenuLink } from "~/components/ui/navigation-menu"
import { authQueryOptions } from "~/lib/auth/queries"

function NavbarActions() {
  const { data: user } = useQuery(authQueryOptions())
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Only render auth-dependent content after hydration to prevent mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const openAuth = () => {
    setShowAuthModal(true)
  }

  // Show skeleton during SSR/hydration to prevent mismatch
  if (!mounted) {
    return (
      <div className="flex gap-2">
        <div className="h-9 w-16 rounded bg-white/20 animate-pulse" />
        <div className="h-9 w-32 rounded bg-white/20 animate-pulse" />
      </div>
    )
  }

  return (
    <>
      {/* Secondary: Login (when not logged in) or Sign Out (when logged in) */}
      {user ? (
        <Button
          onClick={async () => {
            const authClient = (await import("~/lib/auth/auth-client")).default;
            await authClient.signOut();
            window.location.href = "/";
          }}
          size="sm"
          className="font-medium hover:opacity-90 px-4 h-9"
          style={{ backgroundColor: '#fffcf2', color: '#1A1A1A' }}
        >
          Sign out
        </Button>
      ) : (
        <Button size="sm" onClick={openAuth} className="font-medium hover:opacity-90 px-4 h-9" style={{ backgroundColor: '#fffcf2', color: '#1A1A1A' }}>
          Login
        </Button>
      )}
      
      {/* Primary CTA: AI Call your Friend */}
      <CreateCallButton />
      
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          window.location.href = "/create";
        }}
        initialMode="login"
      />
    </>
  )
}

function CreateCallButton() {
  const { data: user } = useQuery(authQueryOptions())
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
        className="font-medium hover:opacity-90 px-4 h-9 rounded-md"
        style={{ backgroundColor: '#86EE02', color: '#1A1A1A' }}
      >
        Prank your Friend
      </Button>
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          window.location.href = "/create";
        }}
        initialMode="signup"
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
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 cursor-pointer no-underline text-white"
          >
            <img
              src={caller.imageUrl || caller.defaultImageUrl}
              alt={caller.name}
              className="h-10 w-10 rounded-full object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white">{caller.name}</div>
              {caller.tagline && (
                <p className="text-xs text-white/70 truncate">
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
    <div className="w-[600px] md:w-[900px] lg:w-[1200px] max-h-[80vh] overflow-y-auto scrollbar-hide rounded-lg" style={{ backgroundColor: '#1A1A1A' }}>
      <div className="grid gap-3 p-4 pb-6 md:grid-cols-4">
      {callers.map((caller) => (
        <NavigationMenuLink key={caller.id} asChild>
          <Link
            to="/callers/$slug"
            params={{ slug: caller.slug }}
            className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-opacity cursor-pointer hover:opacity-80"
            style={{ backgroundColor: '#2A2A2A', color: 'white' }}
          >
            <div className="flex items-start space-x-4">
              <img
                src={caller.imageUrl || caller.defaultImageUrl}
                alt={caller.name}
                className="h-12 w-12 rounded-full object-cover shrink-0"
              />
              <div className="space-y-1 flex-1 min-w-0">
                <div className="text-base font-medium leading-tight text-white">
                  {caller.name}
                </div>
                {caller.tagline && (
                    <p className="line-clamp-2 text-xs leading-snug text-white/70">
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

function NavbarContent() {
  const { data: user, isLoading } = useQuery(authQueryOptions());
  
  const navigationLinks = useMemo<Navbar02NavItem[]>(
    () => {
      const links: Navbar02NavItem[] = [
      {
        href: "/callers",
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
      
      // Only show "Your Calls" if user is logged in AND auth is not loading
      if (!isLoading && user) {
        links.push({
          href: "/your-calls",
          label: "Your Calls",
        });
      }
      
      return links;
    },
    [user, isLoading]
  )

  return (
    <Navbar02
      logo={
        <>
          <Logo variant="full" className="h-8 hidden md:block" forceDark />
          <Logo variant="icon" className="h-8 w-8 md:hidden" />
        </>
      }
      logoHref="/"
      navigationLinks={navigationLinks}
      rightContent={
        isLoading ? (
          <div className="flex gap-2">
            <div className="h-9 w-16 rounded bg-white/20 animate-pulse" />
            <div className="h-9 w-32 rounded bg-white/20 animate-pulse" />
          </div>
        ) : (
          <NavbarActions />
        )
      }
      className="[&_nav_[data-radix-collection-item]]:bg-[#86EE02] [&_nav_[data-radix-collection-item]]:text-[#1A1A1A] [&_.text-muted-foreground]:text-white/70"
    />
  )
}

export function Navbar() {
  return <NavbarContent />
}
