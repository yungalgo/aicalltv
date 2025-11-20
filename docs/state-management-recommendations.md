# State Management Recommendations for Solstice

Based on analysis of React's state management best practices and the current codebase.

## Current State Assessment

### ✅ What We're Doing Right

1. **Minimal State**: Components keep only necessary state
2. **Server State Management**: React Query handles server state excellently
3. **Calculated Values**: Derived values are computed during render, not stored
4. **State Proximity**: State lives close to where it's used

### 🔧 Improvements Made

1. **Custom Hooks for Common Patterns**
   - `useAuthForm` - Eliminates duplicate auth form state
   - `useLocalStorage` - Proper external system synchronization
   - `useFocusOnMount` - DOM manipulation with refs
   - `useAsyncState` - Prevents contradictory loading/error states
   - `useProfileFormReducer` - Groups related form state

2. **Context for Cross-Cutting Concerns**
   - `ThemeContext` - Prevents theme prop drilling

## Recommendations

### 1. Adopt State Structure Principles

**Group Related State**

```typescript
// ❌ Bad: Separate states that change together
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);
const [data, setData] = useState(null);

// ✅ Good: Use a single state or custom hook
const { state, execute } = useAsyncState();
```

**Avoid Contradictions**

```typescript
// ❌ Bad: States that can contradict
const [isSending, setIsSending] = useState(false);
const [isSent, setIsSent] = useState(false);

// ✅ Good: Single state with clear values
const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
```

**Avoid Redundant State**

```typescript
// ❌ Bad: Storing calculated values
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [fullName, setFullName] = useState(""); // Redundant!

// ✅ Good: Calculate during render
const fullName = `${firstName} ${lastName}`;
```

### 2. When to Use Each Tool

**useState**: Simple, independent values

- UI state (open/closed, selected tab)
- Form inputs
- Simple counters

**useReducer**: Complex, related state

- Multi-step forms
- Complex UI with many states
- When state updates depend on previous state

**Context**: Cross-cutting concerns

- Theme
- User authentication (already handled by TanStack Router)
- Feature flags
- Localization

**React Query**: Server state

- API data
- Caching
- Background refetching

### 3. Specific Improvements to Make

1. **Profile Form**: Adopt `useProfileFormReducer` to simplify state management
2. **Theme**: Consider using `ThemeContext` if theme is needed in many components
3. **Auth Forms**: Already improved with `useAuthForm`
4. **Async Operations**: Use `useAsyncState` for non-React Query async operations

### 4. State Anti-Patterns to Avoid

1. **Don't sync props to state** (unless you need an "uncontrolled" component)
2. **Don't duplicate server data** in local state
3. **Don't create deeply nested state** objects
4. **Don't store derived state** that can be calculated

### 5. Future Considerations

As the app grows, consider:

- Feature-based contexts for complex features
- State machines (XState) for complex workflows
- Zustand or Valtio for global client state if needed

## Implementation Priority

1. **High**: Fix redundant auth form state (✅ Done)
2. **Medium**: Refactor profile form with reducer
3. **Low**: Add theme context if needed
4. **Future**: Consider state management library as app scales

The codebase is already following most React state management best practices. The main improvements involve consolidating related state and preventing potential contradictions.
