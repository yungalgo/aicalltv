# Troubleshooting Guide

## Common Issues and Solutions

### Deployment Issues

#### 1. Stale Content After Deployment (Netlify SSR Cache)

**Symptoms**:

- Client JS bundle is updated but HTML shows old content
- Changes visible locally but not in production
- No hydration occurs on the page

**Solution**:

```bash
# Build locally and deploy directly to bypass cache
pnpm build
netlify deploy --prod --dir=dist
```

**Prevention**:

- Use "Clear cache and deploy" option in Netlify UI
- Consider using CLI deployment for critical updates

#### 2. Content Security Policy (CSP) Violations

**Symptoms**:

- Console errors: "Refused to execute inline script"
- Features not working due to blocked scripts

**Solution**:

1. Copy the hash from the error message
2. Add to `netlify/edge-functions/security-headers.ts`:

```typescript
`script-src 'self' 'nonce-${nonce}' 'sha256-YOUR_HASH_HERE' ...`;
```

3. Commit and deploy

### Routing Issues

#### 1. Child Routes Not Rendering

**Symptoms**:

- URL changes but content doesn't update
- Parent route content shows instead of child route
- No routing errors in console

**Root Cause**: Parent route missing `<Outlet />` component

**Solution**:

```typescript
// Parent route must have Outlet
// src/routes/parent/$param.tsx
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/parent/$param")({
  component: () => <Outlet />,
});

// Move parent content to index route
// src/routes/parent/$param.index.tsx
export const Route = createFileRoute("/parent/$param/")({
  component: ParentContent,
});
```

### Authentication Issues

#### 1. "Invalid Origin" Error in Development

**Symptoms**:

- Login fails with "Invalid origin" error
- Different port than expected (e.g., 5174 instead of 5173)

**Solution**:
Add the port to trusted origins in `src/lib/auth/server-helpers.ts`:

```typescript
trustedOrigins: isProduction
  ? [baseUrl]
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:8888"],
```

### Database Issues

#### 1. E2E Test Data Not Updated

**Symptoms**:

- Test events missing expected fields
- Features not available in test environment

**Solution**:

```bash
# Re-run the seed script
pnpm test:e2e:setup
```

For production data updates, create a migration or update script.

### Payment Integration Issues

#### 1. E-Transfer Option Not Showing

**Symptoms**:

- Only Square Checkout visible
- E-transfer option missing from payment methods

**Root Cause**: Event doesn't have e-transfer enabled

**Solution**:
Update event in database with:

- `allowEtransfer: true`
- `etransferRecipient: "email@example.com"`
- `etransferInstructions: "Payment instructions"`

### Development Environment Issues

#### 1. Port Already in Use

**Symptoms**:

- Dev server starts on unexpected port (5174 instead of 5173)

**Solution**:

```bash
# Find and kill process on port 5173
lsof -i :5173
kill -9 <PID>

# Or use a different port
pnpm dev --port 5174
```

#### 2. TypeScript Errors After Route Changes

**Symptoms**:

- Type errors in routeTree.gen.ts
- Routes not recognized

**Solution**:

```bash
# Regenerate route tree
pnpm dev
# or
pnpm build
```

## Quick Reference

### Essential Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Build for production
pnpm test                   # Run tests
pnpm test:e2e              # Run E2E tests
pnpm test:e2e:setup        # Seed E2E data

# Database
pnpm db:migrate            # Run migrations
pnpm db:push               # Push schema changes
pnpm db:studio             # Open Drizzle Studio

# Deployment
git push                   # Standard deploy (auto via Netlify)
netlify deploy --prod --dir=dist  # Manual deploy (bypasses cache)

# Type checking
pnpm check-types           # Check TypeScript types
pnpm lint                  # Run ESLint
pnpm format                # Format with Prettier
```

### Environment Variables

Required for development:

```env
DATABASE_URL=              # PostgreSQL connection
VITE_BASE_URL=            # http://localhost:5173 or http://localhost:8888
BETTER_AUTH_SECRET=       # Session secret
GITHUB_CLIENT_ID=         # GitHub OAuth
GITHUB_CLIENT_SECRET=     # GitHub OAuth secret
GOOGLE_CLIENT_ID=         # Google OAuth
GOOGLE_CLIENT_SECRET=     # Google OAuth secret
```

### Test Accounts

```
test@example.com / testpassword123          # General testing
teamcreator@example.com / testpassword123   # Team creation tests
admin@example.com / testpassword123         # Admin access
```

## Getting Help

1. Check this troubleshooting guide
2. Review relevant documentation in `/docs`
3. Check recent commits for similar issues
4. Create an issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (local/production)
   - Any error messages or logs
