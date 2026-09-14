# 1. Database — General

Database design should reflect domain rules and application access patterns.
If project is using Mongo.db as database, read ./MONGODB.md file.
If project is using Mongo.db as database, read ./POSTGRESQL.md file.

## Integrity

Enforce important invariants as close to the data layer as practical.
Do not rely only on frontend validation.

## Avoid N+1 Queries

Be aware of loops that independently load related records. Prefer:

- joins
- eager loading
- batching
- appropriate aggregation

depending on the database and access pattern.

## Select Necessary Data

Avoid retrieving entire records/documents when only a small subset is required, particularly for expensive or large datasets.

## Indexes

Create indexes based on known access patterns.
Do not add indexes speculatively to every field.
Remember that indexes increase:

- storage usage
- write cost
- maintenance overhead

## Transactions

Use transactions when multiple operations must succeed or fail together.
Do not create large long-running transactions unnecessarily.

## Migrations

Schema changes must use the project's migration mechanism when applicable.
Do not manually modify production database schemas outside established migration processes.
