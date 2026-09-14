# 1. PostgreSQL

Use PostgreSQL's relational capabilities instead of recreating integrity entirely in application code.

## Constraints

Use:

- `NOT NULL`
- foreign keys
- unique constraints
- check constraints

when they represent genuine domain invariants.

Example:

If user email addresses must be unique, prefer enforcing that at the database level as well as handling it in application logic.

## Relationships

Use foreign keys when referential integrity matters.
Do not avoid foreign keys purely for convenience.

## Transactions

Use transactions for related writes that must remain atomic.

## Queries

Always parameterize user-influenced values.
Never construct SQL like:

```ts
`SELECT * FROM users WHERE email = '${email}'`;
```

Use the database library's parameter mechanism.

## JSON / JSONB

Use relational columns for stable structured domain data.
Use JSON/JSONB when data is legitimately:

- flexible
- semi-structured
- provider-specific
- difficult to represent relationally without unnecessary complexity

Do not use JSONB as a default escape hatch instead of designing the relational schema.

## Indexes

Index columns used frequently for:

- filtering
- joins
- sorting
- uniqueness

when query patterns justify it.
Composite index column order should reflect query behavior.
