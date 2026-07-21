import { describe, expect, it } from "vitest";
import { snapshotSelectedFiles } from "./selected-files";

describe("snapshotSelectedFiles", () => {
  it("keeps the selection after the browser clears its live FileList", () => {
    const file = { name: "edital.pdf" } as File;
    const liveFiles = { 0: file, length: 1 } as unknown as FileList;

    const selected = snapshotSelectedFiles(liveFiles);
    (liveFiles as unknown as { length: number }).length = 0;

    expect(selected).toEqual([file]);
  });
});
