import { z } from "zod";
import type {
  IntentPredicate,
  OutcomePredicate,
  PredicateTree,
} from "./types.ts";

export const PREDICATE_MAX_DEPTH = 8;
export const PREDICATE_MAX_NODES = 64;
export const PREDICATE_MAX_BRANCHES = 16;
export type Truth = boolean | undefined;

export const stringCondition = z
  .object({
    field: z.enum(["journeyId", "origin", "destination", "cabin", "partyId"]),
    op: z.enum(["eq", "ne"]),
    value: z.string().min(1).max(120),
  })
  .strict();
export const numberCondition = z
  .object({
    field: z.enum(["durationMinutes", "partySize"]),
    op: z.enum(["eq", "lt", "lte", "gt", "gte"]),
    value: z.number().finite().min(0).max(100000),
  })
  .strict();
export const intentConditionSchema = z.union([
  stringCondition,
  numberCondition,
]);
export const intentEffectSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("seat_position"),
      positions: z
        .array(z.enum(["aisle", "window", "middle"]))
        .min(1)
        .max(3),
    })
    .strict(),
  z
    .object({
      kind: z.literal("seating_together"),
      partyId: z.string().min(1).max(100).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("departure_window"),
      earliest: z.string().datetime({ offset: true }).optional(),
      latest: z.string().datetime({ offset: true }).optional(),
      maxDelayMinutes: z.number().finite().min(0).max(2880).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("baggage"),
      extraPieces: z.number().int().min(0).max(100),
      maxKgPerPiece: z.number().finite().positive().max(100).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("gate_check"), allowed: z.boolean() }).strict(),
  z.object({ kind: z.literal("meal"), receive: z.boolean() }).strict(),
  z
    .object({
      kind: z.literal("credit_budget"),
      maxCredits: z.number().int().min(0).max(1000000),
    })
    .strict(),
]);

/** Check bounds iteratively before recursive parsing, including cyclic non-JSON input. */
function boundedTree<T>(atomSchema: z.ZodType<T>): z.ZodType<PredicateTree<T>> {
  const tree: z.ZodType<PredicateTree<T>> = z.lazy(() =>
    z.union([
      z.object({ kind: z.literal("atom"), condition: atomSchema }).strict(),
      z
        .object({
          kind: z.enum(["and", "or"]),
          terms: z.array(tree).min(1).max(PREDICATE_MAX_BRANCHES),
        })
        .strict(),
      z.object({ kind: z.literal("not"), term: tree }).strict(),
    ]),
  ) as z.ZodType<PredicateTree<T>>;
  return z
    .unknown()
    .superRefine((root, ctx) => {
      const pending = [{ node: root, depth: 1 }];
      let count = 0;
      while (pending.length) {
        const { node, depth } = pending.pop()!;
        if (++count > PREDICATE_MAX_NODES || depth > PREDICATE_MAX_DEPTH) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A condition is limited to ${PREDICATE_MAX_NODES} nodes and ${PREDICATE_MAX_DEPTH} levels`,
          });
          return;
        }
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        if (record.kind === "not")
          pending.push({ node: record.term, depth: depth + 1 });
        if (
          (record.kind === "and" || record.kind === "or") &&
          Array.isArray(record.terms)
        ) {
          if (record.terms.length > PREDICATE_MAX_BRANCHES) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `A condition supports at most ${PREDICATE_MAX_BRANCHES} branches`,
            });
            return;
          }
          pending.push(
            ...record.terms.map((node) => ({ node, depth: depth + 1 })),
          );
        }
      }
    })
    .pipe(tree) as z.ZodType<PredicateTree<T>>;
}
export const intentPredicateSchema: z.ZodType<IntentPredicate> = boundedTree(
  intentConditionSchema,
);
export const outcomePredicateSchema: z.ZodType<OutcomePredicate> = boundedTree(
  z.union([
    intentEffectSchema.options[0],
    intentEffectSchema.options[1],
    intentEffectSchema.options[2],
    intentEffectSchema.options[3],
    intentEffectSchema.options[4],
    intentEffectSchema.options[5],
    z.object({ kind: z.literal("flight_unchanged") }).strict(),
  ]),
);

export function andTruth(values: Truth[]): Truth {
  return values.includes(false)
    ? false
    : values.includes(undefined)
      ? undefined
      : true;
}
export function orTruth(values: Truth[]): Truth {
  return values.includes(true)
    ? true
    : values.includes(undefined)
      ? undefined
      : false;
}
export function evaluatePredicate<T>(
  tree: PredicateTree<T>,
  atom: (condition: T) => Truth,
): Truth {
  if (tree.kind === "atom") return atom(tree.condition);
  if (tree.kind === "not") {
    const value = evaluatePredicate(tree.term, atom);
    return value === undefined ? undefined : !value;
  }
  const values = tree.terms.map((term) => evaluatePredicate(term, atom));
  return tree.kind === "and" ? andTruth(values) : orTruth(values);
}
export function predicateAtoms<T>(tree: PredicateTree<T>): T[] {
  if (tree.kind === "atom") return [tree.condition];
  if (tree.kind === "not") return predicateAtoms(tree.term);
  return tree.terms.flatMap(predicateAtoms);
}
export function describePredicate<T>(
  tree: PredicateTree<T>,
  atom: (condition: T) => string,
): string {
  if (tree.kind === "atom") return atom(tree.condition);
  if (tree.kind === "not") return `not (${describePredicate(tree.term, atom)})`;
  return `(${tree.terms.map((term) => describePredicate(term, atom)).join(tree.kind === "and" ? " and " : " or ")})`;
}
