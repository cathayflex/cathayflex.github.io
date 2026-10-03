import { z } from "zod";

// Prices are published resource reference values. Capacity, another traveller's
// consent, wallet balance and optimizer scores never enter this calculation.
export const REQUEST_PRICING_VERSION = "REFERENCE-2026-10";
const itemSchema = z
  .object({
    kind: z.enum(["seat", "baggage"]),
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
export const requestQuoteSchema = z
  .object({
    version: z.literal(1),
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
    lineItems: z.array(itemSchema).min(1).max(2),
    allowPartial: z.literal(false),
  })
  .strict();
export type RequestQuote = z.infer<typeof requestQuoteSchema>;
