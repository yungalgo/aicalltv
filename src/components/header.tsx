"use client"

import { useEffect, useMemo, useRef, useState, Suspense } from "react"
import { AnimatePresence, motion, MotionConfig } from "motion/react"
import { useTheme } from "~/components/theme-provider"
import { Link } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Logo } from "~/components/logo"
import { AuthModal } from "~/components/auth-modal"
import { SignOutButton } from "~/components/sign-out-button"
import { ThemeToggle } from "~/components/theme-toggle"
import { Button } from "~/components/ui/button"
import { authQueryOptions } from "~/lib/auth/queries"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"

export function useScrollY() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return scrollY
}

export function StickyHeader() {
  const scrollY = useScrollY()
  const stickyNavRef = useRef<HTMLElement>(null)
  const { theme } = useTheme()
  const [active, setActive] = useState(false)
  const [showCallersDropdown, setShowCallersDropdown] = useState(false)

  // Fetch callers for dropdown (client-only to avoid SSR issues)
  const { data: callers = [] } = useQuery({
    queryKey: ["callers"],
    queryFn: async () => {
      // Use absolute URL for server-side compatibility
      const baseUrl = typeof window !== "undefined" 
        ? window.location.origin 
        : process.env.VITE_BASE_URL || "http://localhost:3000"
      const res = await fetch(`${baseUrl}/api/callers`)
      if (!res.ok) throw new Error("Failed to fetch callers")
      return res.json() as Promise<Array<{
        id: string
        slug: string
        name: string
        tagline: string
        defaultImageUrl: string
        gender: string
      }>>
    },
    enabled: typeof window !== "undefined", // Only fetch on client
  })

  const navLinks = useMemo(
    () => [
      { id: 1, label: "Callers", link: "#", isDropdown: true },
      { id: 2, label: "How it Works", link: "/how-it-works" },
    ],
    []
  )

  return (
    <header ref={stickyNavRef} className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-4 md:px-10 md:py-7 xl:px-0">
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <motion.div
            animate={{
              y: scrollY >= 120 ? -50 : 0,
              opacity: scrollY >= 120 ? 0 : 1,
            }}
            transition={{ duration: 0.15 }}
            className="hidden md:block"
          >
            <Logo variant="full" className="h-8" />
          </motion.div>
          <motion.div
            animate={{
              y: scrollY >= 120 ? -50 : 0,
              opacity: scrollY >= 120 ? 0 : 1,
            }}
            transition={{ duration: 0.15 }}
            className="md:hidden"
          >
            <Logo variant="icon" className="h-8 w-8" />
          </motion.div>
        </Link>

        {/* Navigation Links */}
        <ul className="sticky top-4 right-4 left-4 z-[60] hidden items-center justify-center gap-x-5 md:flex">
          <motion.div
            initial={{ x: 0 }}
            animate={{
              boxShadow:
                scrollY >= 120
                  ? theme === "dark"
                    ? "0 0 0 1px rgba(255,255,255,.08), 0 1px 2px -1px rgba(255,255,255,.08), 0 2px 4px rgba(255,255,255,.04)"
                    : "0 0 0 1px rgba(17,24,28,.08), 0 1px 2px -1px rgba(17,24,28,.08), 0 2px 4px rgba(17,24,28,.04)"
                  : "none",
            }}
            transition={{
              ease: "linear",
              duration: 0.05,
              delay: 0.05,
            }}
            className="bg-background flex h-12 w-auto items-center justify-center overflow-hidden rounded-full px-6 py-2.5 transition-all md:p-1.5 md:py-2"
          >
            <nav className="relative h-full items-center justify-between gap-x-3.5 md:flex">
              <ul className="flex h-full flex-col justify-center gap-6 md:flex-row md:justify-start md:gap-0 lg:gap-1">
                {navLinks.map((navItem) => (
                  <li
                    key={navItem.id}
                    className="flex items-center justify-center px-[0.75rem] py-[0.375rem]"
                  >
                    {navItem.isDropdown ? (
                      <DropdownMenu open={showCallersDropdown} onOpenChange={setShowCallersDropdown}>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-1 hover:text-primary">
                            {navItem.label}
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-80 max-h-96 overflow-y-auto">
                          <div className="grid grid-cols-1 gap-2 p-2">
                            {callers.map((caller) => (
                              <a
                                key={caller.id}
                                href={`/callers/${caller.slug}`}
                                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors"
                                onClick={() => setShowCallersDropdown(false)}
                              >
                                <img
                                  src={caller.defaultImageUrl}
                                  alt={caller.name}
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">{caller.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{caller.tagline}</p>
                                </div>
                              </a>
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Link to={navItem.link} className="hover:text-primary">
                        {navItem.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: scrollY >= 120 ? "auto" : 0,
              }}
              transition={{
                ease: "linear",
                duration: 0.25,
                delay: 0.05,
              }}
              className="!hidden overflow-hidden rounded-full md:!block"
            >
              <AnimatePresence>
                {scrollY >= 120 && (
                  <motion.ul
                    initial={{ x: "125%" }}
                    animate={{ x: "0" }}
                    exit={{
                      x: "125%",
                      transition: { ease: "linear", duration: 1 },
                    }}
                    transition={{ ease: "linear", duration: 0.3 }}
                    className="shrink-0 whitespace-nowrap"
                  >
                    <li>
                      <Suspense fallback={null}>
                        <CreateCallButton />
                      </Suspense>
                    </li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </ul>

        {/* Right Side Actions */}
        <motion.div
          className="z-[999] hidden items-center gap-x-4 md:flex"
          animate={{
            y: scrollY >= 120 ? -50 : 0,
            opacity: scrollY >= 120 ? 0 : 1,
          }}
          transition={{ duration: 0.15 }}
        >
          <Suspense fallback={<div className="h-9 w-32" />}>
            <HeaderActions />
          </Suspense>
        </motion.div>

        {/* Mobile Menu Button */}
        <MotionConfig transition={{ duration: 0.3, ease: "easeInOut" }}>
          <motion.button
            onClick={() => setActive((prev) => !prev)}
            animate={active ? "open" : "close"}
            className="relative flex h-8 w-8 items-center justify-center rounded-md md:hidden"
          >
            <motion.span
              style={{ left: "50%", top: "35%", x: "-50%", y: "-50%" }}
              className="absolute h-0.5 w-5 bg-foreground"
              variants={{
                open: {
                  rotate: ["0deg", "0deg", "45deg"],
                  top: ["35%", "50%", "50%"],
                },
                close: {
                  rotate: ["45deg", "0deg", "0deg"],
                  top: ["50%", "50%", "35%"],
                },
              }}
              transition={{ duration: 0.3 }}
            ></motion.span>
            <motion.span
              style={{ left: "50%", top: "50%", x: "-50%", y: "-50%" }}
              className="absolute h-0.5 w-5 bg-foreground"
              variants={{
                open: {
                  opacity: 0,
                },
                close: {
                  opacity: 1,
                },
              }}
            ></motion.span>
            <motion.span
              style={{ left: "50%", bottom: "30%", x: "-50%", y: "-50%" }}
              className="absolute h-0.5 w-5 bg-foreground"
              variants={{
                open: {
                  rotate: ["0deg", "0deg", "-45deg"],
                  top: ["65%", "50%", "50%"],
                },
                close: {
                  rotate: ["-45deg", "0deg", "0deg"],
                  top: ["50%", "50%", "65%"],
                },
              }}
              transition={{ duration: 0.3 }}
            ></motion.span>
          </motion.button>
        </MotionConfig>
      </nav>
    </header>
  )
}

function HeaderActions() {
  const { data: user } = useSuspenseQuery(authQueryOptions())
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("login")

  const openLogin = () => {
    setAuthMode("login")
    setShowAuthModal(true)
  }

  const openSignup = () => {
    setAuthMode("signup")
    setShowAuthModal(true)
  }

  return (
    <>
      {user ? (
        <>
          <a href="/calls">
            <Button variant="ghost" size="sm">
              My Calls
            </Button>
          </a>
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <SignOutButton size="sm" />
        </>
      ) : (
        <>
          <Button variant="ghost" size="sm" onClick={openLogin}>
            Sign In
          </Button>
          <Button size="sm" onClick={openSignup}>
            Sign Up
          </Button>
        </>
      )}
      <CreateCallButton />
      <ThemeToggle />
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        initialMode={authMode}
      />
    </>
  )
}

function CreateCallButton() {
  const { data: user } = useSuspenseQuery(authQueryOptions())
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleClick = () => {
    if (user) {
      window.location.href = "/create"
    } else {
      setShowAuthModal(true)
    }
  }

  return (
    <>
      <Button
        onClick={handleClick}
        className="bg-primary text-primary-foreground relative inline-flex w-fit items-center justify-center gap-x-1.5 overflow-hidden rounded-full px-3 py-1.5 outline-none"
      >
        Create a Prank Call
      </Button>
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        initialMode="signup"
      />
    </>
  )
}

export function Header() {
  return <StickyHeader />
}
