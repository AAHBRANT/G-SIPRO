import { describe, expect, it } from "vitest";

import { consolidateAnalysis } from "./analysis-consolidation";
import type { CommercialDimensionResult } from "./commercial-preliminary-analysis";

const dimension = (
  perspective: "COMMERCIAL" | "TECHNICAL",
  score: number,
  weight: number,
): CommercialDimensionResult => ({
  perspective,
  dimension: perspective,
  status: "CALCULATED",
  score,
  weight,
  confidence: 100,
  summary: "Resultado",
  facts: {},
  calculations: {},
  inferences: [],
  risks: [],
  method: perspective === "COMMERCIAL" ? "commercial-readiness" : "technical-capacity-matrix",
  methodVersion: "1.0.0",
  resultHash: "a".repeat(64),
  pendingItems: [],
});

const policy = {
  coverageMinimum: 70,
  thresholds: { recommendedMinimum: 80, restrictionsMinimum: 60, minimumConfidence: 70 },
};

describe("analysis consolidation", () => {
  it("produces a definitive recommendation when coverage and confidence are sufficient", () => {
    const result = consolidateAnalysis(
      [dimension("COMMERCIAL", 90, 35), dimension("TECHNICAL", 80, 40)],
      policy,
      { hasCriticalFailure: false, hasUnresolvedCritical: false },
    );
    expect(result.coverage).toBe(75);
    expect(result.recommendation).toBe("RECOMMENDED");
  });

  it("gives precedence to a failed critical operational requirement", () => {
    const result = consolidateAnalysis(
      [dimension("COMMERCIAL", 100, 35), dimension("TECHNICAL", 90, 40)],
      policy,
      { hasCriticalFailure: true, hasUnresolvedCritical: false },
    );
    expect(result.recommendation).toBe("NOT_RECOMMENDED");
  });
});
