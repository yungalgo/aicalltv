# Testing Server Functions in Production

This guide covers various approaches to test TanStack Start server functions in production environments.

## 1. Health Check Endpoints

Create dedicated API routes for monitoring:

```typescript
// src/routes/api/health/membership.ts
import { createAPIFileRoute } from "@tanstack/start/api";
import { listMembershipTypes } from "~/features/membership";
import { db } from "~/db";
import { sql } from "drizzle-orm";

export default createAPIFileRoute("/api/health/membership")({
  GET: async () => {
    try {
      // Test database connection
      await db().execute(sql`SELECT 1`);

      // Test membership types query
      const types = await db().select().from(membershipTypes).limit(1);

      return new Response(
        JSON.stringify({
          status: "healthy",
          timestamp: new Date().toISOString(),
          checks: {
            database: "connected",
            membershipTypes: types.length > 0 ? "available" : "empty",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          status: "unhealthy",
          error: error.message,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
});
```

## 2. Integration Tests with Playwright

Create end-to-end tests that run against production:

```typescript
// tests/e2e/membership.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Membership Flow", () => {
  test("should display membership types", async ({ page }) => {
    await page.goto("/dashboard/membership");

    // Should see membership types
    await expect(page.getByText("Annual Player Membership")).toBeVisible();
    await expect(page.getByText("$45.00")).toBeVisible();
  });

  test("should handle checkout flow", async ({ page }) => {
    await page.goto("/dashboard/membership");

    // Click purchase button
    await page.getByRole("button", { name: "Purchase Membership" }).click();

    // Should redirect to mock checkout
    await expect(page).toHaveURL(/mock_checkout=true/);
  });
});
```

## 3. Production Monitoring

### Using Application Performance Monitoring (APM)

Add monitoring to your server functions:

```typescript
// src/features/membership/membership.queries.ts
import { logger } from "~/lib/monitoring";

export const listMembershipTypes = createServerFn({ method: "GET" }).handler(async () => {
  const startTime = Date.now();

  try {
    const result = await db()
      .select()
      .from(membershipTypes)
      .where(eq(membershipTypes.status, "active"));

    // Log successful operations
    logger.info("membership.list", {
      duration: Date.now() - startTime,
      count: result.length,
    });

    return { success: true, data: result };
  } catch (error) {
    // Log errors with context
    logger.error("membership.list.error", {
      error: error.message,
      duration: Date.now() - startTime,
    });

    throw error;
  }
});
```

### Recommended APM Services for Production:

- **Sentry** - Error tracking and performance monitoring
- **New Relic** - Full stack observability
- **Datadog** - Infrastructure and APM
- **LogRocket** - Session replay with network requests

## 4. Synthetic Monitoring

Set up automated checks that run periodically:

```typescript
// scripts/synthetic-check.ts
import fetch from "node-fetch";

const PRODUCTION_URL = process.env.PRODUCTION_URL;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;

async function checkMembershipAPI() {
  try {
    // Check health endpoint
    const healthRes = await fetch(`${PRODUCTION_URL}/api/health/membership`);
    const health = await healthRes.json();

    if (health.status !== "healthy") {
      await notifySlack(`🚨 Membership API unhealthy: ${health.error}`);
      return;
    }

    // Check actual functionality (with test user)
    const loginRes = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
      }),
    });

    if (!loginRes.ok) {
      await notifySlack("🚨 Test user login failed");
      return;
    }

    console.log("✅ All checks passed");
  } catch (error) {
    await notifySlack(`🚨 Synthetic check failed: ${error.message}`);
  }
}

// Run this via cron job or GitHub Actions
checkMembershipAPI();
```

## 5. Manual Testing Checklist

For production deployments, follow this checklist:

### Pre-deployment

- [ ] Run full test suite locally
- [ ] Test with production-like data volume
- [ ] Verify all environment variables are set
- [ ] Check database migrations are applied

### Post-deployment

- [ ] Check health endpoints return 200
- [ ] Verify membership types load
- [ ] Test purchase flow with test account
- [ ] Check error tracking for any new errors
- [ ] Monitor response times for degradation

## 6. Database Query Monitoring

Add query performance tracking:

```sql
-- Check slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%membership%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('memberships', 'membership_types')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 7. Load Testing

Use tools like k6 or Artillery for load testing:

```javascript
// k6-test.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 20 },
    { duration: "30s", target: 0 },
  ],
};

export default function () {
  // Test membership types endpoint
  const res = http.get(`${__ENV.PRODUCTION_URL}/api/membership/types`);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
    "has membership types": (r) => {
      const body = JSON.parse(r.body);
      return body.data && body.data.length > 0;
    },
  });
}
```

## 8. Feature Flags for Safe Testing

Use feature flags to test in production safely:

```typescript
// src/lib/feature-flags.ts
export async function isFeatureEnabled(
  feature: string,
  userId?: string,
): Promise<boolean> {
  // Check if user is in test group
  if (userId && TEST_USER_IDS.includes(userId)) {
    return true;
  }

  // Check global feature flags
  return ENABLED_FEATURES.includes(feature);
}

// In your server function
if (await isFeatureEnabled("new-membership-flow", session.user.id)) {
  // New implementation
} else {
  // Existing implementation
}
```

## 9. Rollback Strategy

Have a plan for quick rollbacks:

1. **Database migrations**: Keep rollback scripts ready
2. **Feature flags**: Can disable features without deployment
3. **Blue-green deployments**: Switch traffic between versions
4. **Database backups**: Before any major changes

## 10. Production Debugging

When issues occur in production:

```typescript
// Add debug endpoints (protect with auth!)
export default createAPIFileRoute("/api/debug/membership")({
  GET: async ({ request }) => {
    // Check auth header
    const auth = request.headers.get("X-Debug-Token");
    if (auth !== process.env.DEBUG_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Return detailed debug info
    const debugInfo = {
      environment: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL ? "set" : "missing",
      squareEnv: process.env.SQUARE_ENV || "not set",
      membershipTypesCount: await db()
        .select({ count: sql<number>`count(*)` })
        .from(membershipTypes),
      recentErrors: await getRecentErrors(),
    };

    return Response.json(debugInfo);
  },
});
```

## Key Recommendations

1. **Start with health checks** - Basic endpoints to verify services are running
2. **Use structured logging** - Makes debugging production issues easier
3. **Monitor key metrics** - Response times, error rates, business metrics
4. **Test with production-like data** - Volume and complexity matter
5. **Have rollback plans** - Be able to revert quickly if issues arise
6. **Use feature flags** - Test new features with subset of users first
7. **Document everything** - Keep runbooks for common issues

Remember: Production testing should be careful and methodical. Always have monitoring in place before deploying new features.
