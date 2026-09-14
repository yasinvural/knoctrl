# 1. Frontend

# 1.1 React

## Components

Use function components.
Components should remain pure during render.
Do not perform side effects during render.
Do not mutate:

- props
- state
- context values
- values returned from hooks

## Component Responsibilities

Keep components focused on a clear UI responsibility.
Extract components when doing so improves:

- readability
- reuse
- separation of responsibilities
- testing
- complexity

Do not extract components simply because a file becomes moderately long.

## State

Keep state as close as possible to where it is used.

Prefer:

```text
local state
```

before:

```text
context/global state
```

unless multiple parts of the application genuinely require the state.

## Derived State

Do not store values in state when they can be derived from existing state or props.

## Avoid Duplicate Sources of Truth

The same logical value should not be independently stored in multiple locations.
Prefer one authoritative source and derive other values from it.

## Hooks

Follow the Rules of Hooks.
Hooks must:

- be called at the top level
- not be called conditionally
- not be called inside loops
- only be called from React components or custom hooks

## `useEffect`

Do not use `useEffect` as the default solution for data transformations.
Use effects primarily to synchronize React with external systems. Examples:

- browser APIs
- subscriptions
- external libraries
- timers
- network behavior that cannot be handled by the framework's data layer

Do not use effects for:

- deriving render values
- transforming props
- synchronizing two pieces of React state unnecessarily

## Custom Hooks

Create custom hooks when:

- behavior is reused
- stateful logic deserves isolation
- lifecycle behavior becomes complex

Do not create trivial wrapper hooks solely to reduce component file length.

## Lists

Use stable keys.
Avoid array index keys when items may:

- reorder
- be inserted
- be removed

## Conditional Rendering

Prefer readable conditions.
Avoid heavily nested ternaries.
Extract complex rendering logic when necessary.

## UI States

Where applicable, explicitly handle:

- loading
- empty
- success
- error
- disabled
- unauthorized

Do not assume only the successful state exists.

# 1.2 Next.js

These rules primarily target projects using the App Router.
Follow the existing router architecture if working in an established project.

## Server Components by Default

Treat Server Components as the default.
Use Client Components only when client-side capabilities are required. Examples:

- state
- event handlers
- effects
- browser APIs
- client-only libraries

Do not add:

```ts
"use client";
```

to a large component tree merely because a small child needs interactivity.
Keep client boundaries small.

## Server and Client Boundaries

Keep server-only functionality on the server. Never expose:

- secrets
- private API credentials
- privileged database access
- server-only authorization logic

to client bundles.

## Data Fetching

Prefer server-side data access when:

- data is required for the initial page
- no browser-only behavior is necessary
- the framework can fetch it directly on the server

Avoid unnecessary client-side fetching after initial render when server rendering already solves the requirement cleanly.

## Mutations

Use the project's established mutation pattern. Possible approaches include:

- Server Actions
- Route Handlers
- backend API endpoints

Do not introduce another mutation mechanism without a clear reason.

## Route Organization

Follow Next.js conventions for:

- `page`
- `layout`
- `loading`
- `error`
- `not-found`
- route handlers

Do not create custom routing abstractions when framework conventions already provide the required behavior.

## Loading and Error Boundaries

Use route-level loading and error boundaries when appropriate.
Avoid putting all error/loading logic inside deeply nested components when Next.js provides a natural route-level boundary.

## Environment Variables

Never expose server secrets using client-visible environment variables.
Only values explicitly intended for browser access should use public environment prefixes.

## Server-Only Modules

Keep sensitive modules out of client dependency graphs.
Database access must never be imported into client components.

# 1.3 Performance

Avoid unnecessary:

- client components
- rerenders
- large dependencies
- network requests
- duplicated data fetching
- expensive computations during render

Do not add memoization everywhere.

Use:

```text
useMemo
useCallback
React.memo
```

only when they solve an actual stability/performance problem or are required for correct dependency behavior.
