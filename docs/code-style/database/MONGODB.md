# 1. MongoDB

MongoDB schemas should be designed around access patterns rather than relational habits.

## Embedding vs Referencing

Prefer embedding when:

- data is usually read together
- the embedded data has a bounded size
- the lifecycle is strongly related
- updates do not require broad synchronization

Prefer references when:

- entities have independent lifecycles
- relationships are many-to-many
- embedded data would grow without bounds
- the same entity is shared broadly

## Avoid Relational Modeling by Default

Do not recreate SQL schemas mechanically in MongoDB.
A document database should use document-oriented modeling where it provides value.

## Avoid Unbounded Arrays

Do not allow document arrays to grow indefinitely.
Large or unbounded relationships should generally be modeled separately.

## Schema Validation

Use schema validation when application data has defined structural requirements.
Do not assume schemaless means structureless.

## Indexes

Create indexes for real query patterns.
Be conscious of index cost during writes.
Review queries before adding indexes solely as speculative optimization.
