import { Github, Instagram, Twitter } from "lucide-react"
import { Logo } from "~/components/logo"
import { Button } from "~/components/ui/button"

// TikTok icon SVG (lucide-react doesn't have TikTok)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
)

// Twitch icon SVG (lucide-react doesn't have Twitch)
const TwitchIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
  </svg>
)

const socialLinks = [
  {
    name: "TikTok",
    url: "https://www.tiktok.com/@aicall.tv",
    icon: TikTokIcon,
  },
  {
    name: "Twitch",
    url: "http://twitch.tv/aicalltv",
    icon: TwitchIcon,
  },
  {
    name: "Twitter",
    url: "https://x.com/aicalltv",
    icon: Twitter,
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/aicall.tv/",
    icon: Instagram,
  },
  {
    name: "GitHub",
    url: "https://github.com/yungalgo/aicalltv",
    icon: Github,
  },
]

export function Footer() {
  return (
    <footer className="w-full border-t bg-muted/50 py-4 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-row flex-wrap items-center justify-between gap-4">
          <Logo variant="full" className="h-8" />
          <div className="flex-1 flex justify-center items-center text-sm text-muted-foreground min-w-0">
            <span className="text-center whitespace-nowrap">
              Made by{" "}
              <a
                href="https://x.com/yungalgorithm"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors underline"
              >
                yung algorithm
              </a>{" "}
              for the{" "}
              <a
                href="https://zypherpunk.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors underline"
              >
                zypherpunk
              </a>{" "}
              hackathon
            </span>
          </div>
          <div className="flex gap-2">
            {socialLinks.map((social) => {
              const IconComponent = social.icon
              return (
                <Button
                  key={social.name}
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <a
                    href={social.url}
                    aria-label={social.name}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IconComponent className="h-4 w-4" />
                  </a>
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </footer>
  )
}
