import { describe, expect, it } from "vitest";

import { TaskStatus } from "@/shared";

import { mockApprovals, mockTasks } from "./data";

describe("frontend mock contracts", () => {
  it("contains an active employee task", () => {
    expect(mockTasks.some((task) => task.status === TaskStatus.WIP)).toBe(true);
  });

  it("contains a pending approval item", () => {
    expect(mockApprovals).toHaveLength(1);
  });
});
