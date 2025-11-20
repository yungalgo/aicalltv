# UI & Component Guide

## Overview

The Quadball Canada platform uses shadcn/ui components built on Radix UI primitives, providing accessible and customizable UI components. This guide focuses on project-specific components and patterns.

## Component System

We use shadcn/ui for foundational components. See `src/components/ui/README.md` for the list of available base components.

## Project-Specific Components

### ValidatedInput

Location: `src/components/form-fields/ValidatedInput.tsx`

A wrapper around the base Input component that adds validation feedback:

```tsx
<ValidatedInput label="Email" name="email" type="email" error={errors.email} required />
```

**Features**:

- Integrated error display
- Required field indicators
- Accessible error announcements
- Consistent spacing

### FormSubmitButton

Location: `src/components/form-fields/FormSubmitButton.tsx`

Smart submit button with loading states:

```tsx
<FormSubmitButton isLoading={mutation.isPending} loadingText="Creating team...">
  Create Team
</FormSubmitButton>
```

**Features**:

- Loading spinner animation
- Disabled state during submission
- Customizable loading text
- Prevents double-submission

### ThemeToggle

Location: `src/components/ThemeToggle.tsx`

Theme switcher supporting light/dark/system modes:

```tsx
<ThemeToggle />
```

**Features**:

- Persists preference to localStorage
- Respects system preference
- Smooth transitions
- Accessible keyboard navigation

## Component Patterns

### Form Components

All forms follow consistent patterns:

```tsx
// Example form structure
<form onSubmit={handleSubmit}>
  <div className="space-y-4">
    <ValidatedInput label="Team Name" name="name" error={errors.name} required />

    <ValidatedInput
      label="Team Slug"
      name="slug"
      error={errors.slug}
      helpText="URL-friendly identifier"
    />

    <FormSubmitButton isLoading={isSubmitting}>Create Team</FormSubmitButton>
  </div>
</form>
```

### Loading States

Consistent loading patterns across the app:

```tsx
// Skeleton loading
if (isLoading) {
  return <TeamCardSkeleton />;
}

// Inline loading
{
  isPending ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <Check className="h-4 w-4" />
  );
}
```

### Error States

User-friendly error displays:

```tsx
// Form field errors
<ValidatedInput error="Email is required" />

// Page-level errors
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertDescription>{error.message}</AlertDescription>
</Alert>
```

## Styling Conventions

### Tailwind Classes

We use Tailwind utility classes with consistent patterns:

```tsx
// Spacing
className = "space-y-4"; // Vertical spacing
className = "gap-4"; // Grid/flex gap

// Cards and containers
className = "rounded-lg border bg-card p-6";

// Interactive elements
className = "hover:bg-accent focus:outline-none focus:ring-2";

// Text styles
className = "text-sm text-muted-foreground";
```

### Component Variants

Using the `class-variance-authority` pattern from shadcn/ui:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input hover:bg-accent",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);
```

## Accessibility

### Required Patterns

1. **Semantic HTML**: Use proper elements (`button`, `nav`, `main`)
2. **ARIA Labels**: Add when visual context isn't enough
3. **Keyboard Navigation**: All interactive elements keyboard accessible
4. **Focus Indicators**: Visible focus rings on all interactive elements
5. **Error Announcements**: Screen reader friendly error messages

### Example Implementation

```tsx
<Button
  aria-label="Delete team"
  aria-describedby="delete-warning"
>
  <Trash2 className="h-4 w-4" />
</Button>
<span id="delete-warning" className="sr-only">
  This action cannot be undone
</span>
```

## Future Components

Consider using GitHub Discussions or a project board to track planned components:

- **DataTable**: Sortable, filterable tables
- **DatePicker**: Accessible date selection
- **FileUpload**: Drag-and-drop uploads
- **RichTextEditor**: For announcements
- **StatsCard**: Animated statistics

## Development Guidelines

### Creating New Components

1. **Check existing components** first - don't recreate what exists
2. **Start with shadcn/ui** - Use as foundation when possible
3. **Follow naming conventions** - PascalCase for components
4. **Include TypeScript types** - Full type safety required
5. **Test accessibility** - Use screen reader and keyboard

### Component File Structure

```
src/
├── components/ui/      # Base shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   └── README.md       # Component list
└── components/         # Project-specific components
    ├── form-fields/
    └── ThemeToggle.tsx
```

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Primitives](https://radix-ui.com)
- [Tailwind CSS Docs](https://tailwindcss.com)
- [React Aria Practices](https://www.w3.org/WAI/ARIA/apg/patterns/)
