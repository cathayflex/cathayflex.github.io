import { z } from "zod";

// Prices are published resource reference values. Capacity, another traveller's
// consent, wallet balance and optimizer scores never enter this calculation.
export const REQUEST_PRICING_VERSION = "REFERENCE-2026-10";
const itemSchema = z
  .object({
    kind: z.enum(["seat", "baggage", "flight", "meal", "service"]),
    label: z.string().min(1).max(180),
    ruleIds: z.array(z.string().min(1).max(100)).min(1).max(30),
    resourceIds: z.array(z.string().min(1).max(120)).min(1).max(1000),
    catalogKey: z.string().min(1).max(100000),
    allocationKeys: z.array(z.string().min(1).max(120)).min(1).max(100),
    quantity: z.number().int().positive().max(100),
    unitCredits: z.number().int().nonnegative().max(1000000),
    credits: z.number().int().nonnegative().max(1000000),
  })
  .strict();
const quoteBase = z
  .object({
    id: z.string().min(1).max(250),
    person: z.string().min(1).max(40),
    journeyId: z.string().min(1).max(100),
    intentId: z.string().min(1).max(100),
    targetRevision: z.number().int().positive(),
    pricingVersion: z.literal(REQUEST_PRICING_VERSION),
    issuedAt: z.number().finite().nonnegative().max(1500),
    validUntil: z.number().finite().nonnegative().max(1500),
    outcomeKey: z.string().min(1).max(100000),
    bookingKey: z.string().min(1).max(100000),
    debit: z.number().int().nonnegative().max(1000000),
    allowPartial: z.literal(false),
  })
  .strict();
const amount = z.number().int().nonnegative().max(1000000);
const settlementItem = itemSchema.extend({
  unitRewardCredits: amount,
  rewardCredits: amount,
  campaign: z
    .object({
      id: z.string().min(1).max(120),
      event: z.string().min(1).max(400),
      credits: amount,
      termsKey: z.string().min(1).max(10000),
    })
    .strict()
    .optional(),
});
export const requestQuoteSchema = z
  .discriminatedUnion("version", [
    // Persisted quotes retain their original charge-only terms.
    quoteBase.extend({
      version: z.literal(1),
      lineItems: z.array(itemSchema).min(1).max(2),
    }),
    quoteBase.extend({
      version: z.literal(2),
      lineItems: z.array(settlementItem).min(1).max(30),
      operationalPlan: z.object({
        id: z.string().min(1).max(250),
        termsKey: z.string().min(1).max(100000),
      }).strict().optional(),
      settlement: z
        .object({
          chargeCredits: amount,
          rewardCredits: amount,
          netCredits: z.number().int().min(-1000000).max(1000000),
        })
        .strict(),
    }),
  ])
  .superRefine((quote, context) => {
    if (quote.version === 1) return;
    const charges = quote.lineItems.reduce(
      (sum, item) => sum + item.credits,
      0,
    );
    const rewards = quote.lineItems.reduce(
      (sum, item) => sum + item.rewardCredits,
      0,
    );
    if (
      quote.lineItems.some(
        (item) =>
          item.credits !== item.unitCredits * item.quantity ||
          item.rewardCredits !== item.unitRewardCredits * item.quantity,
      ) ||
      quote.settlement.chargeCredits !== charges ||
      quote.settlement.rewardCredits !== rewards ||
      quote.settlement.netCredits !== rewards - charges ||
      quote.debit !== Math.max(0, charges - rewards)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The fixed settlement must balance its quoted charges and rewards.",
      });
    }
  });
export type RequestQuote = z.infer<typeof requestQuoteSchema>;
