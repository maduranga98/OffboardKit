import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./firebase", () => import("../test/mocks/firebase"));

const setDocument = vi.fn().mockResolvedValue(undefined);
vi.mock("./firestore", () => ({
  setDocument: (...args: unknown[]) => setDocument(...args),
}));

vi.mock("firebase/firestore", () => ({
  Timestamp: { now: () => ({ seconds: 1700000000, nanoseconds: 0 }) },
}));

import { seedDefaultTemplates } from "./seedData";

describe("seedDefaultTemplates", () => {
  beforeEach(() => setDocument.mockClear());

  it("writes one document per built-in template, namespaced by companyId", async () => {
    await seedDefaultTemplates("co123", "general");
    expect(setDocument).toHaveBeenCalledTimes(3);
    const ids = setDocument.mock.calls.map((c) => c[1]);
    expect(ids).toEqual(["co123_general", "co123_engineer", "co123_sales"]);
    setDocument.mock.calls.forEach((c) => {
      expect(c[0]).toBe("offboardTemplates");
      expect(c[2].companyId).toBe("co123");
    });
  });

  it("marks only the selected template as default", async () => {
    await seedDefaultTemplates("co123", "engineer");
    const defaults = Object.fromEntries(
      setDocument.mock.calls.map((c) => [c[2].id, c[2].isDefault])
    );
    expect(defaults).toEqual({
      co123_general: false,
      co123_engineer: true,
      co123_sales: false,
    });
  });

  it("engineer template extends the general task list with engineering tasks", async () => {
    await seedDefaultTemplates("co123", "general");
    const general = setDocument.mock.calls.find((c) => c[2].id === "co123_general")![2];
    const engineer = setDocument.mock.calls.find((c) => c[2].id === "co123_engineer")![2];
    expect(engineer.tasks.length).toBeGreaterThan(general.tasks.length);
    const generalIds = general.tasks.map((t: { id: string }) => t.id);
    const engineerIds = engineer.tasks.map((t: { id: string }) => t.id);
    expect(engineerIds).toEqual(expect.arrayContaining(generalIds));
  });

  it("every seeded task carries the expected base shape", async () => {
    await seedDefaultTemplates("co123", "general");
    const allTasks = setDocument.mock.calls.flatMap((c) => c[2].tasks);
    for (const t of allTasks) {
      expect(t.type).toBe("checkbox");
      expect(typeof t.title).toBe("string");
      expect(typeof t.assigneeRole).toBe("string");
      expect(typeof t.dayOffset).toBe("number");
      expect(typeof t.order).toBe("number");
    }
  });
});
