# 1. UI

# 1.1 shadcn/ui

Treat shadcn/ui components as application-owned source code.

## Reuse Existing Components

Before creating a UI primitive, check whether an existing shadcn component already solves the requirement.
Prefer using established primitives such as:

- Button
- Dialog
- Dropdown
- Form
- Input
- Select
- Table
- Sheet
- Tabs

when appropriate.

## Do Not Over-Wrap Components

Avoid creating wrapper components that only pass props to a shadcn primitive without adding meaningful behavior or abstraction.
Bad pattern:

```tsx
function MyButton(props: ButtonProps) {
  return <Button {...props} />;
}
```

unless `MyButton` adds meaningful domain/UI behavior.

## Preserve Accessibility

When modifying shadcn components, preserve:

- ARIA behavior
- keyboard navigation
- focus management
- accessible labels

Do not remove accessibility functionality merely to simplify implementation.

## Feature vs Shared Components

Shared UI primitives belong in the project's shared UI area.
Feature-specific components should remain within the relevant feature/domain.
Do not move every component into a global components folder.

# 1.2 Tailwind CSS

Prefer Tailwind utilities for component styling.

## Use Design Tokens

Prefer existing design-system values.

Use:

```text
spacing
colors
font sizes
border radius
breakpoints
```

from the established theme.

Avoid arbitrary values unless necessary.

Prefer:

```text
p-4
gap-2
rounded-md
```

over:

```text
p-[17px]
gap-[7px]
rounded-[11px]
```

without justification.

## Avoid Repetitive Class Sets

If the same substantial visual pattern appears repeatedly, prefer extracting a reusable component rather than duplicating large class lists.

## Conditional Classes

Use the project's class merging utility.

Example:

```ts
cn("base-class", isActive && "active-class");
```

Do not manually concatenate complex conditional class strings.

## Responsive Design

Keep responsive rules close to the base styles they modify.

Example:

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
```

## Avoid Global CSS for Component-Specific Styles

Prefer component-local Tailwind utilities.

Use global CSS for:

- resets
- CSS variables
- typography foundations
- truly global styles
- functionality that Tailwind cannot reasonably express

## Class Ordering

Do not manually enforce Tailwind class ordering.

Use the project's formatting tooling when available.

# 1.3. Accessibility

Accessibility is part of implementation quality. For interactive frontend work:

- use semantic HTML
- ensure keyboard accessibility
- ensure interactive elements have accessible names
- associate labels with form controls
- preserve focus behavior
- communicate validation errors accessibly
- avoid using non-interactive elements as buttons
- provide alt text for meaningful images

Prefer:

```tsx
<button type="button">Save</button>
```

over:

```tsx
<div onClick={handleSave}>Save</div>
```

unless there is a strong reason and accessibility behavior is implemented correctly.
