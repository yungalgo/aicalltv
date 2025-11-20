# Architecture Overview

> 🚧 **Under Construction**: Many subsystems described here are planned but not yet implemented (Teams, Events, Payments, Media Storage). Currently, only Authentication and basic Dashboard features are complete.

## System Architecture

The Quadball Canada platform is built on a modern, type-safe full-stack architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│                                                                  │
│  Browser → TanStack Router → React Components → TanStack Query  │
│                                ↓                                 │
│                         Server Functions                         │
│                                ↓                                 │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Server Layer                              │
│                                                                  │
│  TanStack Start → Better Auth → Business Logic → Drizzle ORM    │
│                                                        ↓         │
│                                                   PostgreSQL     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Choices

1. **[TanStack Start](https://tanstack.com/start)** - Full-stack React framework with type-safe server functions
2. **[Better Auth](https://better-auth.com)** - Modern authentication built for edge/serverless
3. **[Drizzle ORM](https://orm.drizzle.team)** - Type-safe SQL with excellent DX
4. **[Neon PostgreSQL](https://neon.tech)** - Serverless Postgres with connection pooling
5. **[React Query](https://tanstack.com/query)** - Server state management
6. **[Tailwind CSS](https://tailwindcss.com)** + [shadcn/ui](https://ui.shadcn.com)\*\* - Styling system

## Core Principles

### 1. Feature-Based Organization

```
src/features/
├── auth/           # ✅ Implemented
├── teams/          # 🚧 In Progress
├── events/         # ⏳ Planned
├── payments/       # ⏳ Planned
└── analytics/      # ⏳ Planned
```

### 2. Type Safety Everywhere

From database to UI, types flow through the entire stack:

```typescript
// Database schema (source of truth)
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
});

// Automatically inferred types
type User = InferSelectModel<typeof users>;

// Type-safe server function
export const getUser = serverOnly(async (id: string): Promise<User> => {
  return await db.query.users.findFirst({
    where: eq(users.id, id),
  });
});

// Type-safe client usage
const { data: user } = useQuery({
  queryKey: ["user", id],
  queryFn: () => getUser(id),
});
```

### 3. Security First

- Authentication via Better Auth with session management
- Server functions ensure code never runs on client
- Environment variables validated at build time
- CSP headers and security middleware

### 4. Performance Optimization

- Server-side rendering for fast initial loads
- Intelligent caching with React Query
- Route-based code splitting
- Edge deployment via Netlify

## Data Flow

### User Action Example

```
User clicks "Login" → Form submission → Server function validates
    ↓                      ↓                    ↓
React component     TanStack Query      Better Auth verifies
    ↓                      ↓                    ↓
Loading state      Updates cache         Creates session
    ↓                      ↓                    ↓
Redirect           UI updates            Database record
```

## Deployment

### Local Development

- **Vite** - Fast HMR and builds
- **Netlify Dev** - Simulates edge functions
- **Docker** (optional) - PostgreSQL container

### Production

- **Netlify** - Automatic Git deployments
- **Neon** - Managed PostgreSQL
- **Environment** - Validated at build time

## Future Architecture

### Planned Additions

- **Square SDK** - Payment processing (Q2 2025)
- **SendGrid** - Email notifications (Q2 2025)
- **Cloudinary** - Media storage (Q3 2025)
- **WebSockets** - Real-time features (Q4 2025)

### Scalability Path

1. Database connection pooling (current)
2. Read replicas for analytics (future)
3. Redis caching layer (if needed)
4. GraphQL API for mobile (2026)

## Architecture Decision Records

For detailed rationale behind technology choices:

- **[ADR-001](../adr/001-netlify-neon.md)** - Choose Netlify + Neon (planned)
- **[ADR-002](../adr/002-tanstack-start.md)** - Server Functions over REST (planned)
- **[ADR-003](../adr/003-better-auth.md)** - Authentication Strategy (planned)
