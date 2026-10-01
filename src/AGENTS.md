# Source Instructions

Keep source modules small and explicit. Application services own behavior;
transport and adapters translate inputs; repositories own persistence. Do not
put vendor-specific payloads in `src/domain`.
