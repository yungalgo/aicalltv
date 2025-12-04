import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Navbar } from "~/components/navbar";
import { Footer } from "~/components/footer";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { EmblaCarousel } from "~/components/ui/carousel-1";
import { Component as FAQ } from "~/components/ui/faq-4";
import { HomePricing } from "~/components/home-pricing";
import { authQueryOptions } from "~/lib/auth/queries";
import { EmblaOptionsType } from "embla-carousel";
import { AuthModal } from "~/components/auth-modal";
import { LogoSpinner } from "~/components/logo";
import { IPhoneFrame } from "~/components/ui/iphone-frame";
import { ShimmeringText } from "~/components/ui/shimmering-text";
import { Status, StatusIndicator, StatusLabel } from "~/components/ui/status";
import { AnimatedButton } from "~/components/ui/animated-button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// Shared card component for both carousels
function CallerCard({ caller, onClick }: { caller: any; onClick?: () => void }) {
  return (
    <div
      className="group relative flex h-full w-full cursor-pointer rounded-xl border overflow-hidden"
      onClick={onClick}
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={caller.imageUrl || caller.defaultImageUrl}
          alt={caller.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      {/* Frosted Glass Content */}
      <div className="relative z-10 flex h-full w-full flex-col items-start justify-end p-3">
        <div className="rounded-lg border-2 p-3 backdrop-blur-md w-full" style={{ borderColor: '#1A1A1A', backgroundColor: 'rgba(255,252,242,0.1)' }}>
          <h3 className="text-base font-bold text-white mb-1">{caller.name}</h3>
          <p className="text-xs text-white/90 mb-2 line-clamp-2">{caller.tagline}</p>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs">
            {caller.gender}
          </span>
        </div>
      </div>
    </div>
  );
}


// Callers Carousel Component (smooth scroll left)
function CallersCarousel() {
  const { data: callers = [] } = useQuery({
    queryKey: ["callers"],
    queryFn: async () => {
      const res = await fetch("/api/callers");
      if (!res.ok) throw new Error("Failed to fetch callers");
      return res.json();
    },
  });

  const OPTIONS: EmblaOptionsType = {
    loop: true,
    align: "start",
    duration: 25, // Smooth scroll duration
  };

  const slides = callers.map((caller: any) => (
    <CallerCard
      key={caller.id}
      caller={caller}
      onClick={() => {
        window.location.href = `/callers/${caller.slug}`;
      }}
    />
  ));

    return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-4">
          <div className="inline-block rounded-2xl border-2 px-8 py-4" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
            <h2 className="text-3xl font-bold mb-2" style={{ color: '#1A1A1A' }}>choose your caller</h2>
            <p style={{ color: '#1A1A1A', opacity: 0.7 }}>
              each ai caller has a unique personality, voice, and vibe
            </p>
          </div>
        </div>
      </div>
      {/* Carousel outside container for edge-to-edge */}
      <EmblaCarousel
        slides={slides}
        options={OPTIONS}
        autoplay={true}
        autoplayDelay={3000}
        showIndicators={false}
        showArrows={false}
        className="w-full"
      />
      <div className="container mx-auto px-4">
        <div className="text-center mt-4">
          <Button asChild size="lg" className="font-medium hover:opacity-80" style={{ backgroundColor: '#1A1A1A', color: 'white' }}>
            <Link to="/callers">Browse All Callers</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// Video style options
const VIDEO_STYLES = [
  { value: "anime", label: "anime" },
  { value: "pixar", label: "pixar / 3d" },
  { value: "realistic", label: "realistic" },
  { value: "comic", label: "comic book" },
  { value: "watercolor", label: "watercolor" },
];

// Weird placeholder names for the friend's name input
const WEIRD_NAMES = [
  "morgenstein phillips",
  "garboothius melogus",
  "prith quosop",
  "mclellan bottomsby",
  "bartholomew crinklesworth",
  "fenwick pumpernickel",
  "thaddeus wobblekins",
  "gertrude snickerbottom",
  "reginald fluffernutter",
  "percival dingleberry",
  "horatio bumblebee",
  "cornelius finklebine",
];

// Hero Section - Clean layout with text/CTA left, phone frame right
function HeroSection() {
  const { data: user } = useQuery(authQueryOptions());
  const { data: callers = [] } = useQuery({
    queryKey: ["callers"],
    queryFn: async () => {
      const res = await fetch("/api/callers");
      if (!res.ok) throw new Error("Failed to fetch callers");
      return res.json();
    },
  });
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const [leftColumnHeight, setLeftColumnHeight] = useState<number | null>(null);
  
  // Measure left column height
  useEffect(() => {
    const updateHeight = () => {
      if (leftColumnRef.current) {
        setLeftColumnHeight(leftColumnRef.current.offsetHeight);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);
  
  // Random placeholder name (changes on refresh)
  const [nameIndex] = useState(() => Math.floor(Math.random() * WEIRD_NAMES.length));
  
  // Form state
  const [friendName, setFriendName] = useState("");
  const [friendNumber, setFriendNumber] = useState("");
  const [videoStyle, setVideoStyle] = useState("");
  const [selectedCaller, setSelectedCaller] = useState("");
  
  // Active prankers count (random between 2-12, fluctuates slightly)
  const [activePrankers, setActivePrankers] = useState(() => Math.floor(Math.random() * 11) + 2);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePrankers((prev) => {
        // Randomly change by -1, 0, or +1
        const change = Math.floor(Math.random() * 3) - 1;
        const newValue = prev + change;
        // Keep within 2-12 range
        return Math.max(2, Math.min(12, newValue));
      });
    }, 60000 + Math.random() * 180000); // Change every 1-4 minutes (60,000ms + up to 180,000ms)
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    const formData = {
      recipientName: friendName,
      recipientPhone: friendNumber,
      videoStyle: videoStyle,
      callerSlug: selectedCaller,
    };
    sessionStorage.setItem("quickPrankForm", JSON.stringify(formData));
    
    if (user) {
      navigate({ to: "/create" });
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <section className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center lg:flex-row lg:items-start lg:justify-center gap-8 lg:gap-12 max-w-4xl mx-auto">
          {/* Left side - Hero Text + Form */}
          <div ref={leftColumnRef} className="w-full max-w-xl flex flex-col">
            {/* Hero Text Card */}
            <div className="rounded-2xl border-2 p-6 md:p-8 mb-4" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight" style={{ color: '#1A1A1A' }}>
                <ShimmeringText
                  text="prank call your friends with ai"
                  duration={3}
                  wave={false}
                  color="#1A1A1A"
                  shimmeringColor="#86EE02"
                />
              </h1>
              <p className="text-sm" style={{ color: '#1A1A1A', opacity: 0.7 }}>
                fill out a few details and an ai will prank call your friend live. we'll send you a video of the recording afterwards. web3 payment rails with fhe pii encryption.
              </p>
            </div>
            
            {/* Quick Form Card */}
            <div className="rounded-2xl border-2 p-6" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#1A1A1A' }}>quick call</h3>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <Label htmlFor="friendName" className="text-xs" style={{ color: '#1A1A1A' }}>friend's name</Label>
                  <Input
                    id="friendName"
                    placeholder={WEIRD_NAMES[nameIndex]}
                    value={friendName}
                    onChange={(e) => setFriendName(e.target.value)}
                    className="mt-1 border-2 h-9 text-sm"
                    style={{ borderColor: '#1A1A1A', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <Label htmlFor="friendNumber" className="text-xs" style={{ color: '#1A1A1A' }}>phone number</Label>
                  <Input
                    id="friendNumber"
                    placeholder="+1 555-123-4567"
                    value={friendNumber}
                    onChange={(e) => setFriendNumber(e.target.value)}
                    className="mt-1 border-2 h-9 text-sm"
                    style={{ borderColor: '#1A1A1A', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <Label htmlFor="videoStyle" className="text-xs" style={{ color: '#1A1A1A' }}>video style</Label>
                  <Select value={videoStyle} onValueChange={setVideoStyle}>
                    <SelectTrigger className="mt-1 border-2 h-9 text-sm" style={{ borderColor: '#1A1A1A', backgroundColor: 'white' }}>
                      <SelectValue placeholder="choose style" />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_STYLES.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="caller" className="text-xs" style={{ color: '#1A1A1A' }}>caller</Label>
                  <Select value={selectedCaller} onValueChange={setSelectedCaller}>
                    <SelectTrigger className="mt-1 border-2 h-9 text-sm" style={{ borderColor: '#1A1A1A', backgroundColor: 'white' }}>
                      <SelectValue placeholder="select caller" />
                    </SelectTrigger>
                    <SelectContent>
                      {callers.map((caller: any) => (
                        <SelectItem key={caller.slug} value={caller.slug}>
                          {caller.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-center">
              <AnimatedButton 
                onClick={handleSubmit}
                icon={<span>📞</span>}
                iconPosition="left"
                className="font-semibold py-5 px-12 text-base rounded-md"
                style={{ backgroundColor: '#86EE02', color: '#1A1A1A' }}
              >
                Prank your Friend →
              </AnimatedButton>
              </div>
              
              {/* Active prankers status */}
              <div className="flex justify-end mt-3">
                <Status status="online" variant="outline" size="sm" className="border-0 gap-1.5">
                  <StatusIndicator ping />
                  <StatusLabel className="text-xs" style={{ color: '#1A1A1A', opacity: 0.6 }}>
                    {activePrankers} pranking right now
                  </StatusLabel>
                </Status>
              </div>
            </div>
          </div>

          {/* Right side - iPhone Frame with Video */}
          <div className="hidden lg:block flex-shrink-0">
            <IPhoneFrame 
              videoSrc="/call-1174c834-3e26-4299-b67b-53d3b0d9b5db-video.mp4" 
              height={leftColumnHeight || undefined}
            />
          </div>
        </div>
      </div>
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          window.location.href = "/create";
        }}
        initialMode="signup"
      />
    </section>
  );
}

function HomePage() {
  // Check if callers data is loaded
  const { isLoading: callersLoading } = useQuery({
    queryKey: ["callers"],
    queryFn: async () => {
      const res = await fetch("/api/callers");
      if (!res.ok) throw new Error("Failed to fetch callers");
      return res.json();
    },
  });

  const isLoading = callersLoading;

  return (
    <div className="flex min-h-svh flex-col pb-24 overflow-x-hidden"> {/* padding for fixed footer */}
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        {isLoading ? (
          <LogoSpinner fixed size="lg" />
        ) : (
          <>
            <HeroSection />
            <CallersCarousel />
            <section className="py-8">
              <FAQ />
            </section>
            <section className="py-8">
              <HomePricing />
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
