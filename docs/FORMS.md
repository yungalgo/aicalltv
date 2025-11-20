# Forms Documentation

This document provides a comprehensive guide to form implementation in the Solstice application using TanStack Form with Zod validation.

## Table of Contents

1. [Form Components Index](#form-components-index)
2. [Architecture Overview](#architecture-overview)
3. [Form Field Components](#form-field-components)
4. [Validation Patterns](#validation-patterns)
5. [Best Practices](#best-practices)
6. [Migration Guide](#migration-guide)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)

## Form Components Index

### Location: `src/components/form-fields/`

| Component              | Location                                                                                                        | Purpose                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `ValidatedInput`       | [`src/components/form-fields/ValidatedInput.tsx`](../src/components/form-fields/ValidatedInput.tsx)             | Text inputs with validation        |
| `ValidatedSelect`      | [`src/components/form-fields/ValidatedSelect.tsx`](../src/components/form-fields/ValidatedSelect.tsx)           | Dropdown selection with validation |
| `ValidatedCheckbox`    | [`src/components/form-fields/ValidatedCheckbox.tsx`](../src/components/form-fields/ValidatedCheckbox.tsx)       | Checkbox inputs with validation    |
| `ValidatedDatePicker`  | [`src/components/form-fields/ValidatedDatePicker.tsx`](../src/components/form-fields/ValidatedDatePicker.tsx)   | Date selection with age validation |
| `ValidatedColorPicker` | [`src/components/form-fields/ValidatedColorPicker.tsx`](../src/components/form-fields/ValidatedColorPicker.tsx) | Color picker for team colors       |
| `ValidatedCombobox`    | [`src/components/form-fields/ValidatedCombobox.tsx`](../src/components/form-fields/ValidatedCombobox.tsx)       | Searchable dropdown selection      |
| `FormSubmitButton`     | [`src/components/form-fields/FormSubmitButton.tsx`](../src/components/form-fields/FormSubmitButton.tsx)         | Submit button with loading states  |

### Form Implementations

| Form                 | Location                                                                                                                                  | Status           | Validation           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------- |
| **Login Form**       | [`src/features/auth/components/login.tsx`](../src/features/auth/components/login.tsx)                                                     | ✅ TanStack Form | ⚠️ Inline validation |
| **Signup Form**      | [`src/features/auth/components/signup.tsx`](../src/features/auth/components/signup.tsx)                                                   | ✅ TanStack Form | ✅ Zod schemas       |
| **Profile Complete** | [`src/features/profile/components/complete-profile-form-simple.tsx`](../src/features/profile/components/complete-profile-form-simple.tsx) | ✅ TanStack Form | ✅ Zod schemas       |
| **Profile Edit**     | [`src/features/profile/components/profile-view.tsx`](../src/features/profile/components/profile-view.tsx)                                 | ✅ TanStack Form | ✅ Zod schemas       |
| **Team Creation**    | [`src/routes/dashboard/teams/create.tsx`](../src/routes/dashboard/teams/create.tsx)                                                       | ✅ TanStack Form | ⚠️ Inline validation |
| **Team Management**  | [`src/routes/dashboard/teams/$teamId.manage.tsx`](../src/routes/dashboard/teams/$teamId.manage.tsx)                                       | ✅ TanStack Form | ⚠️ Inline validation |
| **Team Members**     | [`src/routes/dashboard/teams/$teamId.members.tsx`](../src/routes/dashboard/teams/$teamId.members.tsx)                                     | ✅ TanStack Form | ⚠️ Inline validation |

### Schema Definitions

| Schema              | Location                                                                                | Purpose                      |
| ------------------- | --------------------------------------------------------------------------------------- | ---------------------------- |
| **Auth Schemas**    | [`src/features/auth/auth.schemas.ts`](../src/features/auth/auth.schemas.ts)             | Login and signup validation  |
| **Profile Schemas** | [`src/features/profile/profile.schemas.ts`](../src/features/profile/profile.schemas.ts) | Profile form validation      |
| **Team Schemas**    | [`src/features/teams/teams.schemas.ts`](../src/features/teams/teams.schemas.ts)         | Team creation and management |

### Form Utilities

| Utility             | Location                                                        | Purpose                             |
| ------------------- | --------------------------------------------------------------- | ----------------------------------- |
| **useAppForm Hook** | [`src/lib/hooks/useAppForm.ts`](../src/lib/hooks/useAppForm.ts) | TanStack Form wrapper with defaults |
| **Form Types**      | [`src/lib/form.ts`](../src/lib/form.ts)                         | Type definitions and helpers        |

## Architecture Overview

### TanStack Form Integration

All forms use TanStack Form for:

- **Type Safety**: Full TypeScript integration with form state
- **Field Validation**: Real-time validation with error handling
- **Form State Management**: Automatic form state tracking
- **Performance**: Optimized re-renders and change tracking

### Validation Strategy

1. **Zod Schemas** (Preferred): Runtime validation with type inference
2. **Inline Validation** (Legacy): Direct validator functions in field definitions

### Component Pattern

```tsx
// Standard form implementation pattern
const form = useForm({
  defaultValues: {
    /* initial values */
  },
  onSubmit: async ({ value }) => {
    // Handle form submission
  },
});

// Field usage pattern
<form.Field name="fieldName" validators={{ onChange: schema.parse }}>
  {(field) => <ValidatedInput field={field} label="Field Label" />}
</form.Field>;
```

## Form Field Components

### ValidatedInput

**Location**: `src/components/form-fields/ValidatedInput.tsx`

**Features**:

- All HTML input types supported
- Real-time validation display
- Loading state integration
- Accessibility features (ARIA labels, error descriptions)

**Usage**:

```tsx
<form.Field name="email" validators={{ onChange: emailSchema.parse }}>
  {(field) => (
    <ValidatedInput
      field={field}
      label="Email Address"
      type="email"
      placeholder="user@example.com"
      autoComplete="email"
    />
  )}
</form.Field>
```

### ValidatedSelect

**Location**: `src/components/form-fields/ValidatedSelect.tsx`

**Features**:

- Dropdown selection with validation
- Custom option arrays
- Placeholder support

**Usage**:

```tsx
const options = [
  { value: "option1", label: "Option 1" },
  { value: "option2", label: "Option 2" },
];

<form.Field name="selection">
  {(field) => (
    <ValidatedSelect
      field={field}
      label="Choose Option"
      options={options}
      placeholderText="Select an option"
    />
  )}
</form.Field>;
```

### ValidatedCheckbox

**Location**: `src/components/form-fields/ValidatedCheckbox.tsx`

**Features**:

- Boolean value handling
- Optional descriptions
- Accessibility compliance

**Usage**:

```tsx
<form.Field name="agreement">
  {(field) => (
    <ValidatedCheckbox
      field={field}
      label="I agree to the terms and conditions"
      description="Required to proceed with registration"
    />
  )}
</form.Field>
```

### ValidatedDatePicker

**Location**: `src/components/form-fields/ValidatedDatePicker.tsx`

**Features**:

- Age validation (min/max age constraints)
- Automatic date range calculation
- HTML5 date input with fallbacks

**Usage**:

```tsx
<form.Field name="dateOfBirth" validators={{ onChange: dateSchema.parse }}>
  {(field) => (
    <ValidatedDatePicker field={field} label="Date of Birth" minAge={13} maxAge={120} />
  )}
</form.Field>
```

## Validation Patterns

### Zod Schema Pattern (Recommended)

```tsx
// Define schema
const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  age: z.number().min(13, "Must be at least 13 years old"),
});

// Use in form
const form = useForm({
  defaultValues: { name: "", email: "", age: 0 },
  onSubmit: async ({ value }) => {
    const validated = userSchema.parse(value); // Runtime validation
    await submitUser(validated);
  },
});

// Field validation
<form.Field
  name="email"
  validators={{
    onChange: ({ value }) => {
      try {
        userSchema.shape.email.parse(value);
        return undefined;
      } catch (error) {
        return error.errors[0]?.message;
      }
    },
  }}
>
  {(field) => <ValidatedInput field={field} label="Email" />}
</form.Field>;
```

### Server Function Validation

```tsx
// Server function with Zod validation
export const createUser = createServerFn({ method: "POST" })
  .validator(userSchema.parse)
  .handler(async ({ data }) => {
    // data is fully typed and validated
    return await database.users.create(data);
  });
```

### Cross-Field Validation

```tsx
// Password confirmation validation
<form.Field
  name="confirmPassword"
  validators={{
    onChangeListenTo: ["password"],
    onChange: ({ value, fieldApi }) => {
      if (value !== fieldApi.form.getFieldValue("password")) {
        return "Passwords do not match";
      }
      return undefined;
    },
  }}
>
  {(field) => <ValidatedInput field={field} type="password" />}
</form.Field>
```

## Best Practices

### 1. Schema-First Validation

**✅ Do**:

```tsx
const schema = z.object({
  email: z.string().email("Invalid email"),
});

<form.Field name="email" validators={{ onChange: schema.shape.email.parse }}>
```

**❌ Don't**:

```tsx
<form.Field
  name="email"
  validators={{
    onChange: ({ value }) => !value ? "Email required" : undefined
  }}
>
```

### 2. Consistent Error Handling

**✅ Do**:

```tsx
const form = useForm({
  onSubmit: async ({ value }) => {
    try {
      const result = await submitData(value);
      if (result.success) {
        navigate("/success");
      } else {
        setError(result.errors?.[0]?.message || "Unknown error");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  },
});
```

### 3. Loading State Management

**✅ Do**:

```tsx
<FormSubmitButton isSubmitting={form.state.isSubmitting} loadingText="Saving...">
  Save Changes
</FormSubmitButton>
```

### 4. Accessibility

**✅ Do**:

- Always provide labels
- Use proper input types
- Include error descriptions
- Support keyboard navigation

### 5. Performance

**✅ Do**:

- Use `onChangeAsyncDebounceMs` for expensive validation
- Minimize re-renders with proper field scoping
- Use `form.reset()` instead of setting individual fields

## Migration Guide

### From useState to TanStack Form

**Before** (useState pattern):

```tsx
const [formData, setFormData] = useState({ name: "", email: "" });
const [errors, setErrors] = useState({});

const handleSubmit = (e) => {
  e.preventDefault();
  // Manual validation and submission
};

<form onSubmit={handleSubmit}>
  <input
    value={formData.name}
    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
  />
</form>;
```

**After** (TanStack Form):

```tsx
const form = useForm({
  defaultValues: { name: "", email: "" },
  onSubmit: async ({ value }) => {
    await submitData(value);
  },
});

<form
  onSubmit={(e) => {
    e.preventDefault();
    form.handleSubmit();
  }}
>
  <form.Field name="name">
    {(field) => <ValidatedInput field={field} label="Name" />}
  </form.Field>
</form>;
```

### Adding Validation

**Step 1**: Create Zod schema

```tsx
const schema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
});
```

**Step 2**: Apply to fields

```tsx
<form.Field
  name="email"
  validators={{ onChange: schema.shape.email.parse }}
>
```

## Common Patterns

### Multi-Step Forms

```tsx
const [currentStep, setCurrentStep] = useState(0);
const form = useForm({
  onSubmit: async ({ value }) => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }
    await submitFinalForm(value);
  },
});
```

### Conditional Fields

```tsx
const showPhoneField = form.getFieldValue("contactMethod") === "phone";

{
  showPhoneField && (
    <form.Field name="phone">
      {(field) => <ValidatedInput field={field} type="tel" />}
    </form.Field>
  );
}
```

### Dynamic Field Arrays

```tsx
// For complex arrays, consider using form.Field with array syntax
<form.Field name={`items.${index}.name`}>
  {(field) => <ValidatedInput field={field} />}
</form.Field>
```

## Troubleshooting

### Common Issues

**1. Field not updating**

- Check field name matches form structure
- Ensure proper field prop passing to components

**2. Validation not working**

- Verify Zod schema syntax
- Check error handling in validator functions

**3. Form not submitting**

- Confirm `form.handleSubmit()` is called
- Check for validation errors preventing submission

**4. TypeScript errors**

- Ensure form types match schema inference
- Use proper type assertions for complex nested objects

### Debug Tools

```tsx
// Form state debugging
console.log("Form state:", form.state);
console.log("Field value:", form.getFieldValue("fieldName"));
console.log("Form errors:", form.state.errors);
```

### Performance Issues

```tsx
// Add debouncing for expensive validation
<form.Field
  name="search"
  validators={{
    onChangeAsyncDebounceMs: 300,
    onChangeAsync: async ({ value }) => {
      return await validateSearch(value);
    },
  }}
>
```

## Next Steps

1. **Complete Migration**: Update remaining forms to use Zod schemas
2. **Enhanced Components**: Add more specialized form components as needed
3. **Form Templates**: Create reusable form templates for common patterns
4. **Testing**: Add comprehensive form testing utilities
5. **Documentation**: Keep this guide updated as patterns evolve
