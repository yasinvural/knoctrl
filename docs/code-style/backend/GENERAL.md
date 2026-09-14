# 1. Backend

# 1.1 General Backend Principles

Separate transport concerns from business logic.
HTTP-specific code should not dominate the domain/service layer. Prefer logical boundaries such as:

```text
route
→ handler/controller
→ service/business logic
→ repository/data access
```

when the project complexity justifies them.

Do not create every architectural layer automatically for trivial functionality.
Architecture should solve complexity rather than create it.

# 1.2 Node.js

Use modern async APIs.

Prefer:

```ts
async / await;
```

over deeply chained promises.

Do not block the event loop with CPU-intensive synchronous operations when they can materially affect application responsiveness.
Heavy CPU work may require:

- worker threads
- background jobs
- external processing

depending on project requirements.

## Environment Configuration

Configuration should come from explicit application configuration/environment sources.
Do not scatter direct environment reads throughout the codebase when the project uses a central configuration layer.
Validate required environment variables during application startup when practical.

## Secrets

Never commit:

- passwords
- API secrets
- private tokens
- database credentials
- private keys

Do not log secrets.

# 1.3 Express

## Keep Route Definitions Small

Routes should primarily define:

- route path
- middleware
- handler

Avoid placing complex business logic directly inside route definitions.

## Thin Controllers

Controllers/handlers should generally:

1. read request input
2. call application/business logic
3. translate the result into an HTTP response

Avoid large controllers containing business rules and database logic.

## Input Validation

Validate external inputs at application boundaries.

Validate:

- request body
- route parameters
- query parameters
- headers when relevant

Do not trust TypeScript types for runtime input validation.
TypeScript does not validate runtime requests.
Use the project's established validation library. Like Zod
Do not introduce another schema library without justification.

## Error Handling

Use centralized error handling where appropriate.

Avoid repeating:

```ts
try {
  ...
} catch (error) {
  res.status(500).json(...);
}
```

through every controller if the project already uses centralized error middleware.

## HTTP Status Codes

Use meaningful status codes. Common examples:

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
500 Internal Server Error
```

Use the convention already established by the project when distinctions such as `400` vs `422` have been standardized.

## API Responses

Use consistent response shapes within the project.
Do not introduce multiple unrelated error formats.

# 1.4 API Design

Keep APIs consistent. Follow existing conventions for:

- routes
- naming
- pagination
- filtering
- sorting
- errors
- response shapes

Prefer resource-oriented naming where appropriate.

Prefer:

```text
GET /users/:id
POST /projects
DELETE /projects/:id
```

over action-heavy routes unless the domain action genuinely deserves one.

Example legitimate action:

```text
POST /invitations/:id/accept
```

## Pagination

Do not return unbounded large collections.
Use pagination where data sets may grow significantly.
Choose cursor or offset pagination based on requirements and existing project conventions.

## Idempotency

Consider idempotency for operations that may be retried and have meaningful side effects. Examples:

- payments
- external webhook processing
- job execution

Do not introduce idempotency infrastructure unnecessarily.

# 1.5 Performance

Avoid:

- repeated database queries
- N+1 access patterns
- loading unnecessary fields
- sequential operations that can safely execute concurrently
- blocking CPU work inside request handlers

Do not parallelize dependent operations.
