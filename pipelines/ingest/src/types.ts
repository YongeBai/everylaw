import { z } from "zod";

export const parsedNodeSchema = z.object({
  identifier: z.string().min(1),
  parentIdentifier: z.string().nullable(),
  nodeType: z.string().min(1),
  levelPath: z.string().min(1),
  sortKey: z.string().min(1),
  citation: z.string().min(1),
  num: z.string(),
  heading: z.string(),
  status: z.enum(["active", "repealed", "reserved", "omitted", "transferred"]),
  bodyHtml: z.string(),
  bodyText: z.string(),
  sourceCredit: z.string().nullable(),
  enactingPl: z.string().nullable(),
  enactedDate: z.string().nullable(),
  amendmentCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  contentHash: z.string().length(64),
  releasePoint: z.string().min(1),
});

export type ParsedNode = z.infer<typeof parsedNodeSchema>;
