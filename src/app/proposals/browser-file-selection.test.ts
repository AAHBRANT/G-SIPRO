import { describe, expect, it } from "vitest";
import { snapshotSelectedFiles } from "./browser-file-selection";

describe("snapshotSelectedFiles", () => {
  it("keeps the selection when clearing the input empties its live FileList", () => {
    const selected = [new File(["edital"], "Edital São Paulo.pdf", { type: "application/pdf" })];
    const liveFileList = {
      get length() { return selected.length; },
      item: (index: number) => selected[index] ?? null,
      [Symbol.iterator]: () => selected[Symbol.iterator](),
    } as FileList;

    const snapshot = snapshotSelectedFiles(liveFileList);
    selected.length = 0;

    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]?.name).toBe("Edital São Paulo.pdf");
  });
});
