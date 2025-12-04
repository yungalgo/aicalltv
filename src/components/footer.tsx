import { Link } from "@tanstack/react-router"
import { Logo } from "~/components/logo"

const socialLinks = [
  {
    name: "TikTok",
    url: "https://www.tiktok.com/@aicall.tv",
    icon: "🎵",
  },
  {
    name: "Twitch",
    url: "http://twitch.tv/aicalltv",
    icon: "🎮",
  },
  {
    name: "Twitter",
    url: "https://x.com/aicalltv",
    icon: "🐦",
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/aicall.tv/",
    icon: "📷",
  },
]

const productLinks = [
  { text: "Features", url: "/" },
  { text: "Pricing", url: "/" },
  { text: "How it Works", url: "/how-it-works" },
]

const legalLinks = [
  { text: "Privacy Policy", url: "/privacy" },
  { text: "Terms of Service", url: "/terms" },
  { text: "Contact", url: "/contact" },
]

const companyLinks = [
  { text: "About", url: "/about" },
  { text: "Blog", url: "/blog" },
]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="flex flex-col gap-y-5 border-t bg-muted/50 px-7 py-5 md:px-10 mt-auto">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
          {/* Brand Section */}
          <div className="flex flex-col gap-4">
            <Logo variant="text" className="h-6" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Personalized AI video calls with generated video content.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-4 pt-2">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors text-xl"
                  aria-label={social.name}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {/* Product Links */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Product</h3>
              <ul className="flex flex-col gap-2">
                {productLinks.map((link) => (
                  <li key={link.text}>
                    <Link
                      to={link.url}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Links */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Legal</h3>
              <ul className="flex flex-col gap-2">
                {legalLinks.map((link) => (
                  <li key={link.text}>
                    <Link
                      to={link.url}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Company</h3>
              <ul className="flex flex-col gap-2">
                {companyLinks.map((link) => (
                  <li key={link.text}>
                    <Link
                      to={link.url}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            © {currentYear} AI Call TV. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Made with ❤️ for creators</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
