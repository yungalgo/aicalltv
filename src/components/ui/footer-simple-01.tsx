"use client";

import { Button } from "~/components/ui/button";
import { Logo } from "~/components/logo";

const YEAR = new Date().getFullYear();

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
];

export default function FooterSimple01() {
  return (
    <footer className="w-full border-t bg-muted/50 pb-8 pt-16 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-row flex-wrap items-center justify-center gap-x-10 gap-y-2 md:justify-between">
          <div className="flex flex-col items-center md:items-start gap-2">
            <Logo variant="text" className="h-6" />
            <p className="text-foreground text-center md:text-left text-sm font-medium">
              © {YEAR} AI Call TV. All rights reserved.
            </p>
          </div>
          <div className="flex gap-2">
            {socialLinks.map((social) => (
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
                  className="text-xl"
                >
                  {social.icon}
                </a>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

