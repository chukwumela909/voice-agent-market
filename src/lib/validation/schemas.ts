import { z } from 'zod';

// Portfolio validation schemas
export const portfolioCreateSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  quantity: z.number().positive('Quantity must be positive'),
  avgBuyPrice: z.number().positive('Average buy price must be positive'),
  marketType: z.enum(['crypto', 'stock', 'forex']),
});

export const portfolioUpdateSchema = z.object({
  quantity: z.number().positive('Quantity must be positive').optional(),
  avgBuyPrice: z.number().positive('Average buy price must be positive').optional(),
});

// Alert validation schemas
export const alertCreateSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  condition: z.enum(['above', 'below', 'change_percent']),
  targetPrice: z.number().positive().optional(),
  percentageChange: z.number().optional(),
}).refine(
  (data) => {
    if (data.condition === 'change_percent') {
      return data.percentageChange !== undefined;
    }
    return data.targetPrice !== undefined;
  },
  {
    message: 'Either targetPrice or percentageChange is required based on condition',
  }
);

export const alertUpdateSchema = z.object({
  condition: z.enum(['above', 'below', 'change_percent']).optional(),
  targetPrice: z.number().positive().optional(),
  percentageChange: z.number().optional(),
  isActive: z.boolean().optional(),
});

// User profile validation schemas
export const profileUpdateSchema = z.object({
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  preferredMarkets: z.array(z.enum(['crypto', 'stocks', 'forex'])).optional(),
  notificationPreferences: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      voice: z.boolean().optional(),
    })
    .optional(),
});

// Market query validation
export const marketQuerySchema = z.object({
  symbols: z.string().transform((s) => s.split(',').map((sym) => sym.trim().toUpperCase())),
  marketType: z.enum(['crypto', 'stock', 'forex', 'all']).optional(),
});

export const analysisQuerySchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  timeframe: z.enum(['1d', '1w', '1m', '3m']).default('1d'),
  marketType: z.enum(['crypto', 'stock', 'forex']).optional(),
});

// Validate and parse input, throwing a formatted error if invalid
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`);
    throw new Error(`Validation error: ${errors.join(', ')}`);
  }
  
  return result.data;
}

// Type exports
export type PortfolioCreate = z.infer<typeof portfolioCreateSchema>;
export type PortfolioUpdate = z.infer<typeof portfolioUpdateSchema>;
export type AlertCreate = z.infer<typeof alertCreateSchema>;
export type AlertUpdate = z.infer<typeof alertUpdateSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
