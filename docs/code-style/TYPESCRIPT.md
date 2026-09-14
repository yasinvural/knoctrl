# 1. TypeScript

TypeScript should be treated as a correctness tool rather than merely syntax.

## 1.1 Strict Type Safety

Preserve TypeScript `strict` mode.
Do not weaken TypeScript configuration to avoid fixing type errors.

## 1.2 Avoid `any`

Do not introduce `any` unless there is a strong technical reason.
If `any` is unavoidable, keep its scope as small as possible and document why.

## 1.3 Avoid Unsafe Type Assertions

Do not use type assertions purely to silence TypeScript errors.

Avoid patterns such as:

```ts
value as SomeType;
```

when the runtime value has not been validated.

Especially avoid:

```ts
value as unknown as SomeType;
```

unless there is a documented and justified interoperability reason.

Prefer:

- type guards
- schema validation
- proper type definitions
- narrowing

## 1.4 Prefer Type Inference

Allow TypeScript to infer obvious local types.
Explicitly annotate types when they improve clarity at important boundaries.

Examples:

- public functions
- exported APIs
- service contracts
- complex object structures

## 1.5 Use Domain Types

Avoid passing primitive values everywhere when a meaningful domain type improves safety.

Example:

```ts
type UserId = string;
```

Use this when the distinction provides actual value.

Do not create branded types for every primitive without a meaningful reason.

## 1.6 Prefer Discriminated Unions

For mutually exclusive states, prefer discriminated unions.

Example:

```ts
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: Error };
```

Prefer this over structures that allow invalid state combinations.

## 1.7 Avoid Duplicate Types

Do not manually recreate types that can safely be derived from an existing source.
Prefer deriving types from:

- validation schemas
- database models
- API contracts
- existing domain definitions

when doing so does not create inappropriate coupling.

## 1.8 Prefer Literal Unions When Appropriate

Prefer:

```ts
type Status = "pending" | "completed" | "failed";
```

when an enum does not provide meaningful additional value.
Use enums only when they clearly improve interoperability or domain modeling.

## 1.9 Handle Nullable Values Explicitly

Do not assume values are present when they may be `null` or `undefined`.

Avoid:

```ts
user!.name;
```

unless presence has already been guaranteed by program flow and is clearly justified.

Prefer proper narrowing.
