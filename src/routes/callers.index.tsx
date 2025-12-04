import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "~/components/navbar";
import { Footer } from "~/components/footer";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/callers/")({
  component: CallersPage,
});

function CallerCard({ caller }: { caller: any }) {
  return (
    <Link
      to="/callers/$slug"
      params={{ slug: caller.slug }}
      className="group relative flex h-full w-full cursor-pointer rounded-xl border overflow-hidden no-underline"
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
    </Link>
  );
}

function CallersPage() {
  const { data: callers = [], isLoading } = useQuery({
    queryKey: ["callers"],
    queryFn: async () => {
      const res = await fetch("/api/callers");
      if (!res.ok) throw new Error("Failed to fetch callers");
      return res.json();
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Browse All Callers</h1>
          <p className="text-muted-foreground text-lg">
            Choose from our collection of AI callers, each with unique personalities and styles
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading callers...</p>
          </div>
        ) : callers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No callers available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {callers.map((caller: any) => (
              <div key={caller.id} className="h-80">
                <CallerCard caller={caller} />
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

