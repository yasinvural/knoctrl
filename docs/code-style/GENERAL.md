# 1. General Engineering Principles

## 1.1 Prefer Simplicity

Prefer the simplest solution that correctly satisfies the requirement. Avoid:

- unnecessary abstractions
- premature generalization
- unnecessary indirection
- overly generic utilities
- speculative infrastructure
- clever code that reduces readability

Do not create abstractions for hypothetical future requirements.
Introduce abstractions when there is a clear current need.

## 1.2 Follow Existing Patterns

Before introducing new code:

1. inspect nearby implementation
2. inspect existing utilities
3. inspect existing abstractions
4. inspect naming and folder conventions
5. reuse established patterns when appropriate

Do not introduce a new architectural pattern when the project already has a suitable established pattern.
Consistency is generally more valuable than introducing another equally valid approach.

## 1.3 Keep Responsibilities Focused

Functions, components, classes, modules, and services should have a clear responsibility. Avoid modules that:

- perform unrelated operations
- mix business logic with transport logic
- mix data access with UI concerns
- contain multiple unrelated abstractions

Do not split code purely to reduce line count.
Split code when doing so improves:

- readability
- reuse
- testability
- separation of concerns
- architectural boundaries

## 1.4 Prefer Explicit Code

Prefer code where behavior and dependencies are clear. Avoid:

- hidden side effects
- implicit global state
- surprising mutations
- excessive metaprogramming
- unnecessarily dynamic behavior

Explicit dependencies are preferred over hidden dependencies.

## 1.5 Avoid Unrelated Changes

Changes must remain scoped to the current task. Do not:

- refactor unrelated modules
- reformat unrelated files
- rename unrelated code
- upgrade unrelated dependencies
- fix unrelated technical debt
- modify behavior outside the approved scope

If unrelated problems are discovered, document them separately.

## 1.6 Avoid Premature Optimization

Write clear and correct code first. Optimize when:

- there is a known performance problem
- the requirement explicitly demands it
- the implementation is obviously inefficient for expected workloads

Performance optimizations should have a clear justification.

## 1.7 Prefer Composition

Prefer composition over inheritance. Build behavior by composing:

- functions
- components
- hooks
- services
- small modules

Avoid deep inheritance hierarchies.

## 1.8 Remove Dead Code

Do not leave:

- unused variables
- unused functions
- commented-out implementations
- obsolete feature code
- stale imports

Source control already preserves history.

# 2. Naming

Names should communicate intent.
Avoid abbreviations unless they are well-known within the domain.

## 2.1 Boolean Naming

Boolean values should generally communicate a yes/no question.
Avoid unclear names such as:

## 2.2 Function Naming

Functions should normally use verbs.
Functions that return boolean values should normally communicate the condition:

## 2.3 Component Naming

React component names must use PascalCase.
Component filenames should follow the established repository convention.
Do not introduce a second naming convention into the same project.

## 2.4 Constants

Use descriptive constant names.
Avoid unexplained magic values.

# 3. Functions

## 3.1 Keep Functions Focused

A function should perform one coherent responsibility.
If a function:

- validates
- persists
- sends email
- formats output
- updates unrelated state

consider separating responsibilities.

## 3.2 Prefer Early Returns

Use early returns when they reduce nesting.

## 3.3 Avoid Excessive Parameters

When a function requires many related parameters, consider an object.

## 3.4 Do Not Mutate Inputs

Unless mutation is explicitly part of the API contract, do not mutate function arguments.
Prefer returning a new result.

# 4. Error Handling

Errors must be handled intentionally.
Do not:

- silently swallow errors
- use empty catch blocks
- expose internal errors to users
- return ambiguous success values after failures

## 4.1 Preserve Useful Context

When wrapping an error, preserve relevant context.

Example:

```ts
throw new Error(`Failed to create project: ${projectId}`, {
  cause: error,
});
```

when supported by the runtime/project.

## 4.2 Expected vs Unexpected Errors

Distinguish between:

- validation errors
- business rule failures
- authorization failures
- missing resources
- infrastructure failures
- unexpected errors

Do not treat all failures as HTTP 500.

# 5. Security

Security rules apply across frontend and backend.
Never trust client input.
Validate and sanitize input where appropriate.
Do not expose sensitive information through:

- API responses
- client bundles
- logs
- error messages

Use parameterized database queries.
Do not construct queries using raw untrusted string interpolation.
Avoid storing sensitive tokens in insecure browser storage when more secure mechanisms are appropriate.
Use secure cookie settings when using authentication cookies.

Consider:

```text
HttpOnly
Secure
SameSite
```

according to the project's authentication model.
Do not implement custom cryptography.
Use established libraries.
Passwords must be hashed using appropriate password hashing algorithms.
Never store plaintext passwords.

# 6. Logging and Observability

Logs should provide useful operational information without exposing sensitive data. Avoid logging:

- passwords
- tokens
- authentication cookies
- payment details
- unnecessary personal information

Errors should include sufficient context to investigate failures.
Do not use excessive `console.log` statements in production application code.
Use the project's logging abstraction when available.

# 7. Dependencies

Before adding a dependency:

1. check whether the project already contains a suitable dependency
2. check whether the runtime/framework already provides the functionality
3. evaluate whether the dependency is maintained
4. consider bundle/runtime impact
5. justify the added complexity

Do not add packages for trivial functionality.

# 8. Comments

Prefer self-explanatory code.
Comments should explain:

- why a decision exists
- non-obvious domain behavior
- important workarounds
- unusual constraints

Avoid comments that merely restate the code.

# 9. Imports

Follow the project's import conventions.
Prefer consistent import aliases when configured.
Avoid deep relative paths.
Remove unused imports.
Avoid circular dependencies.

# 10. Code Formatting

Code formatting should be automated.
Use the project's configured formatter.
Do not manually introduce formatting rules that conflict with automated tooling.

# 11. Async and Concurrency

Understand whether operations are:

- sequential
- independent
- concurrent
- cancellable

Independent operations may use:

```ts
Promise.all(...)
```

when failure semantics are appropriate.
Do not introduce concurrency merely for style.

## Race Conditions

For client requests where newer operations supersede older ones, consider cancellation or stale-response protection. Example scenarios:

- search autocomplete
- filter requests
- live validation

Do not assume requests return in the same order they were initiated.
