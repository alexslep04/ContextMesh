# Storage Instructions

Use Drizzle for ordinary schema and queries. Keep FTS5 virtual-table SQL in
versioned migrations and synchronize it transactionally with memory versions.
Never expose database handles to transport or adapter code.
