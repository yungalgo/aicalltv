# Rate Limiting with TanStack Pacer

This document describes how we use TanStack Pacer for client-side rate limiting in the Solstice application.

## Overview

TanStack Pacer provides client-side rate limiting to prevent users from overwhelming the server with too many requests. This is complementary to server-side rate limiting and provides immediate user feedback.

## Key Concepts

### Client-Side vs Server-Side Rate Limiting

- **Client-Side (TanStack Pacer)**: Prevents requests from being sent, provides immediate user feedback, improves UX
- **Server-Side (Existing middleware)**: Final protection layer, prevents abuse, works across all clients

Both layers work together for comprehensive protection.

### Rate Limit Types

We have predefined rate limit configurations in `src/lib/pacer/rate-limit-config.ts`:

| Type       | Limit | Window     | Window Type | Use Case                          |
| ---------- | ----- | ---------- | ----------- | --------------------------------- |
| `auth`     | 5     | 15 minutes | Fixed       | Login, signup, password reset     |
| `api`      | 100   | 1 minute   | Sliding     | General API calls                 |
| `search`   | 10    | 10 seconds | Sliding     | Search operations                 |
| `mutation` | 20    | 1 minute   | Fixed       | Create, update, delete operations |

### Window Types

- **Fixed Window**: Resets completely after the window period
- **Sliding Window**: Gradually allows new requests as old ones expire

## Usage Guide

### Basic Usage with Server Functions

```typescript
import { useRateLimitedServerFn } from "~/lib/pacer/hooks";
import { myServerFunction } from "~/features/myfeature/mutations";

function MyComponent() {
  // Apply rate limiting to any server function
  const rateLimitedFn = useRateLimitedServerFn(
    myServerFunction,
    { type: "api" }, // or "auth", "search", "mutation"
  );

  const handleAction = async () => {
    try {
      const result = await rateLimitedFn({
        data: {
          /* ... */
        },
      });
      // Handle success
    } catch (error) {
      // Handle server errors (rate limit errors show toast automatically)
    }
  };
}
```

### Search Operations

For search operations, use the specialized hook:

```typescript
import { useRateLimitedSearch } from "~/lib/pacer/hooks";

function SearchComponent() {
  const rateLimitedSearch = useRateLimitedSearch(
    async (query: string) => {
      return await searchServerFn({ data: { query } });
    }
  );

  return (
    <input
      onChange={(e) => rateLimitedSearch(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

### Custom Rate Limiting

For custom configurations:

```typescript
import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer";

function CustomComponent() {
  const rateLimitedAction = useAsyncRateLimitedCallback(
    async (data: any) => {
      return await myServerFunction({ data });
    },
    {
      limit: 3,
      window: 30 * 1000, // 30 seconds
      windowType: "fixed",
      onReject: (limiter) => {
        // Custom handling
        console.log(`Wait ${limiter.getMsUntilNextWindow()}ms`);
      },
    },
  );
}
```

### Accessing Rate Limiter State

Subscribe to rate limiter state for UI feedback:

```typescript
const rateLimitedFn = useRateLimitedServerFn(
  myServerFunction,
  { type: "api" },
  // Selector for reactive state
  (state) => ({
    executionCount: state.executionCount,
    rejectionCount: state.rejectionCount,
    isExecuting: state.isExecuting,
  })
);

// Use in UI
<button disabled={rateLimitedFn.state.isExecuting}>
  Submit ({rateLimitedFn.state.executionCount}/100)
</button>
```

## Integration Examples

### Login Form with Rate Limiting

See `src/features/auth/components/login-with-rate-limit.tsx` for a complete example of rate limiting authentication attempts.

### Team Creation

```typescript
const rateLimitedCreateTeam = useRateLimitedServerFn(createTeam, { type: "mutation" });

const handleCreate = async (teamData: TeamInput) => {
  const team = await rateLimitedCreateTeam({ data: teamData });
  // Team created successfully
};
```

### Membership Purchase

```typescript
const rateLimitedCheckout = useRateLimitedServerFn(createCheckoutSession, {
  type: "mutation",
  onReject: () => {
    // Custom handling for payment rate limiting
    alert("Too many payment attempts. Please wait before trying again.");
  },
});
```

## Best Practices

1. **Choose the Right Type**: Use appropriate rate limit types for different operations
   - `auth` for authentication operations
   - `search` for search/filter operations
   - `mutation` for create/update/delete
   - `api` for general queries

2. **User Feedback**: The default toast notifications work well, but consider custom handling for critical operations

3. **State Management**: Only subscribe to state you need to minimize re-renders

4. **Error Handling**: Rate limit rejections are handled separately from server errors:

   ```typescript
   try {
     await rateLimitedFn(data);
   } catch (error) {
     // This is a server error, not a rate limit
     console.error("Server error:", error);
   }
   ```

5. **Testing**: In development, you can trigger rate limits quickly to test the UI behavior

## Migration Guide

To migrate existing components to use rate limiting:

1. Import the rate limiting hook:

   ```typescript
   import { useRateLimitedServerFn } from "~/lib/pacer/hooks";
   ```

2. Wrap your server function calls:

   ```typescript
   // Before
   const result = await myServerFunction({ data });

   // After
   const rateLimitedFn = useRateLimitedServerFn(myServerFunction, { type: "api" });
   const result = await rateLimitedFn({ data });
   ```

3. Test the rate limiting behavior in development

## Monitoring

Rate limiting events can be monitored through:

1. Browser console in development (when rate limits are hit)
2. Toast notifications shown to users
3. Custom `onReject` handlers for analytics

## Future Enhancements

1. **Persistent State**: Save rate limit state to localStorage to persist across page reloads
2. **Analytics Integration**: Track rate limit events for monitoring
3. **Dynamic Limits**: Adjust limits based on user tier or permissions
4. **Retry Queue**: Automatically retry rejected requests when the window resets
