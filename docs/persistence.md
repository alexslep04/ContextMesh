# Persistence Slice

The first persistence slice stores normalized event history and current
coordination projections in SQLite:

- `cm_events`
- `cm_sessions`
- `cm_tasks`
- `cm_warnings`

`SqliteEventPersistence` owns schema initialization, reload, and transactional
projection writes. `EventProcessor` remains vendor-independent and accepts the
persistence port through dependency injection.

The `cm_*` prefix is deliberate. The pulled repository state also contains
`src/database/schema.sql`, which defines a separate generic schema. This slice
avoids silently sharing or altering those tables. Schema reconciliation belongs
to a later migration unit.
