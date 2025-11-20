# Rate Limiting Documentation

## Overview

The application uses **client-side rate limiting** with TanStack Pacer to protect against abuse and ensure fair usage. This approach prevents excessive requests before they're sent and provides immediate user feedback.

Rate limiting is applied at different levels:

1. **Authentication endpoints** - Stricter limits for sensitive operations
2. **API endpoints** - General limits for regular API calls
3. **Search operations** - Optimized for rapid queries
4. **Mutations** - Balanced limits for write operations

## Client-Side Rate Limiting

We use TanStack Pacer for client-side rate limiting. See [Rate Limiting with TanStack Pacer](./rate-limiting-with-pacer.md) for detailed documentation on:

- Using the `useRateLimitedServerFn` hook
- Rate limit presets and configuration
- Integration examples
- Best practices

## Configuration

Rate limits are configured in `src/lib/pacer/rate-limit-config.ts`:

```typescript
auth: {
  limit: 5,
  window: 15 * 60 * 1000, // 15 minutes
  windowType: "fixed"
},
api: {
  limit: 100,
  window: 60 * 1000, // 1 minute
  windowType: "sliding"
},
search: {
  limit: 10,
  window: 10 * 1000, // 10 seconds
  windowType: "sliding"
},
mutation: {
  limit: 20,
  window: 60 * 1000, // 1 minute
  windowType: "fixed"
}
```

## How It Works

TanStack Pacer implements client-side rate limiting using:

- **Token bucket algorithm** for smooth request distribution
- **Local storage persistence** to maintain limits across page reloads
- **Immediate user feedback** via toast notifications

When the rate limit is exceeded, users see a toast message:

```
Too many requests. Please try again in X seconds.
```

## Implementation Details

### Using Rate Limiting

To add rate limiting to any server function call:

```typescript
import { useRateLimitedServerFn } from "~/lib/pacer";

// In your component
const rateLimitedCreateTeam = useRateLimitedServerFn(createTeam, { type: "mutation" });

// Use it like the original function
await rateLimitedCreateTeam({ data: teamData });
```

### Rate Limit Types

- **auth**: For authentication operations (login, signup, password reset)
- **api**: For general API calls
- **search**: For search operations with debouncing
- **mutation**: For data modifications

### Why Client-Side Only?

For serverless deployments (like Netlify), client-side rate limiting is more effective because:

1. **No shared state needed** between function invocations
2. **Immediate feedback** without network round-trips
3. **Reduced server load** by preventing requests entirely
4. **Better UX** with instant feedback

For additional protection, consider using:

- CDN-level rate limiting (Netlify, Cloudflare)
- Web Application Firewall (WAF) rules

## Testing

To test rate limiting in development:

1. Open your browser's developer console
2. Rapidly click a button that triggers a rate-limited server function
3. After hitting the limit, you should see a toast notification
4. Check local storage for `tanstack-pacer-*` entries to see stored limits

## Future Improvements

1. **Server-Side Validation**: Add server-side rate limiting for defense in depth
2. **User-based Limits**: Different limits for authenticated vs anonymous users
3. **Dynamic Limits**: Adjust limits based on user tier or subscription
4. **Analytics**: Track rate limit hits for monitoring abuse patterns
5. **Gradual Backoff**: Implement exponential backoff for repeated violations
