import { describe, it, expect } from "vitest";
import { EventProcessor } from "../../src/application/event-processor.js";
import { generateContext } from "../../src/application/context.js";
import { events } from "../helpers.js";
describe("budgeted context", () => {
  it("returns current related memories with provenance and excludes another project", () => {
    const processor = new EventProcessor(), clock = events();
    for (const project of ["p", "other"]) processor.ingest(clock.event("session_started", {}, "a", project));
    processor.ingest(clock.event("decision_recorded", { memoryId: "auth", decision: "Old choice", rationale: "Old reason" }));
    processor.ingest(clock.event("decision_recorded", { memoryId: "auth", decision: "Current choice", rationale: "Current reason", relatedFiles: ["src/auth.ts"] }));
    processor.ingest(clock.event("decision_recorded", { memoryId: "unrelated", decision: "Other choice", rationale: "Reason", relatedFiles: ["other.ts"] }));
    processor.ingest(clock.event("decision_recorded", { memoryId: "secret", decision: "Other project", rationale: "Private" }, "a", "other"));
    const input = { projectId: "p", files: ["src/auth.ts"], budget: 8000 };
    const context = generateContext(processor.snapshot(), input);
    expect(context.items[0]).toMatchObject({ kind: "decision", summary: "Current choice", rationale: "Current reason", sessionId: "a" });
    expect(JSON.stringify(context)).not.toContain("Old choice"); expect(JSON.stringify(context)).not.toContain("Other project");
    expect(context).toEqual(generateContext(processor.snapshot(), input));
    expect(context.used).toBe(JSON.stringify(context).length);
  });
  it("enforces the serialized character budget and reports truncation", () => {
    const processor = new EventProcessor(), clock = events(); processor.ingest(clock.event("session_started"));
    processor.ingest(clock.event("decision_recorded", { memoryId: "large", decision: "x".repeat(1000), rationale: "Reason" }));
    const context = generateContext(processor.snapshot(), { projectId: "p", budget: 256 });
    expect(context.truncated).toBe(true); expect(JSON.stringify(context).length).toBeLessThanOrEqual(256);
    expect(() => generateContext(processor.snapshot(), { projectId: "p", budget: -1 })).toThrow();
    expect(() => generateContext(processor.snapshot(), { projectId: "p".repeat(200), budget: 256 })).toThrow("envelope");
  });
});
