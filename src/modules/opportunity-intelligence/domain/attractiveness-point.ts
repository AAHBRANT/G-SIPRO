import { z } from "zod";

export const attractivenessPointInputSchema = z.object({
  category: z.enum(["QUALITATIVE", "QUANTITATIVE"]),
  description: z.string().trim().min(5).max(1000),
  amount: z.number().finite().optional(),
}).superRefine((value, context) => {
  if (value.category === "QUANTITATIVE" && value.amount === undefined) {
    context.addIssue({ code: "custom", path: ["amount"], message: "Informe o valor estimado para um ponto quantitativo." });
  }
  if (value.category === "QUALITATIVE" && value.amount !== undefined) {
    context.addIssue({ code: "custom", path: ["amount"], message: "Pontos qualitativos não têm valor em R$." });
  }
});

export type AttractivenessPointInput = z.infer<typeof attractivenessPointInputSchema>;

export type AttractivenessPointRecord = Readonly<{
  id: string;
  category: "QUALITATIVE" | "QUANTITATIVE";
  description: string;
  amount: number | null;
  createdAt: string;
  createdBy: string;
}>;
