import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useEffect } from "react";
import type React from "react";
import { Navbar } from "~/components/navbar";
import { Footer } from "~/components/footer";
import { Button } from "~/components/ui/button";
import { EmblaCarousel } from "~/components/ui/carousel-1";
import { Component as FAQ } from "~/components/ui/faq-4";
import { HomePricing } from "~/components/home-pricing";
import { authQueryOptions } from "~/lib/auth/queries";
import { PAYMENT_CONFIG } from "~/lib/web3/config";
import { EmblaOptionsType } from "embla-carousel";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

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
      <div className="relative z-10 flex h-full w-full flex-col items-start justify-end p-6">
        <div className="rounded-xl border border-white/20 bg-white/10 p-5 backdrop-blur-md w-full">
          <h3 className="text-xl font-bold text-white mb-2">{caller.name}</h3>
          <p className="text-sm text-white/90 mb-3">{caller.tagline}</p>
          <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs">
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
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Choose Your Caller</h2>
          <p className="text-muted-foreground">
            Select from our collection of AI callers, each with unique personalities
          </p>
        </div>
        <EmblaCarousel
          slides={slides}
          options={OPTIONS}
          autoplay={true}
          autoplayDelay={3000}
          showIndicators={false}
          showArrows={false}
          className="w-full"
        />
        <div className="text-center mt-8">
          <Button asChild size="lg">
            <a href="#callers">Browse All Callers</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

// Calls Carousel Component (smooth scroll right - reverse, same cards as callers)
function CallsCarousel() {
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

  const [emblaRef, emblaApi] = useEmblaCarousel(OPTIONS);

  // Smooth reverse autoplay - scroll backwards every 3 seconds
  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => {
      emblaApi.scrollPrev();
    }, 3000);
    return () => clearInterval(interval);
  }, [emblaApi]);

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
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Calls</h2>
          <p className="text-muted-foreground">
            Browse our collection of AI callers
          </p>
        </div>
        <div className="overflow-visible py-10" ref={emblaRef}>
          <div className="embla__container flex">
            {slides.map((slide: React.ReactNode, index: number) => (
              <div
                className="embla__slide [flex:0_0_20rem] pl-4 max-[350px]:[flex:0_0_18rem]"
                key={index}
              >
                <div className="embla__slide__content h-full min-h-[25rem] w-full">
                  {slide}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center mt-8">
          <Button asChild size="lg">
            <Link to="/create">Create Your Own</Link>
              </Button>
        </div>
          </div>
    </section>
  );
}

function HomePage() {
  const { data: user } = useSuspenseQuery(authQueryOptions());

  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<div className="py-16 text-center">Loading...</div>}>
          <CallersCarousel />
        </Suspense>
        <CallsCarousel />
        <section className="py-16 bg-muted/30">
          <FAQ />
        </section>
        <section className="py-16">
          <HomePricing />
        </section>
      </main>
      <Footer />
        </div>
  );
}
