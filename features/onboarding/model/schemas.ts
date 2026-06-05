import { z } from 'zod';

const ONBOARDING_DESCRIPTION_MAX_LENGTH = 20_000;

export const onboardingDraftResultCompleteSchema = z.object({
  organization: z.object({
    name: z.string(),
    description: z.string(),
  }),
  goals: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      tasks: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          type: z.enum(['development', 'organization']),
          priority: z.number(),
        }),
      ),
    }),
  ),
  team: z.array(
    z.object({
      name: z.string(),
      email: z.string().nullable(),
      role: z.string().nullable(),
      found_in: z.array(z.string()),
      already_in_system: z.boolean(),
      system_user_id: z.number().nullable(),
    }),
  ),
});

export const onboardingDraftResultNeedsInfoSchema = z.object({
  needs_more_info: z.literal(true),
  message: z.string(),
  questions: z.array(z.string()),
});

export const onboardingDraftResultSchema = z.union([
  onboardingDraftResultCompleteSchema,
  onboardingDraftResultNeedsInfoSchema,
]);

export const onboardingDraftResponseSchema = z.object({
  id: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  error: z.string().nullable(),
  result: onboardingDraftResultSchema.nullable(),
});

export const generateSchema = z.object({
  description: z.string().max(ONBOARDING_DESCRIPTION_MAX_LENGTH).optional(),
  links: z.array(z.url().max(2048)).max(5).optional(),
});

const taskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: z.enum(['development', 'organization']).optional(),
  priority: z.number().int().optional(),
});

const goalSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  tasks: z.array(taskSchema).max(20).optional(),
});

export const UserRoleSchema = z.enum(['manager', 'employee']);

const teamMemberSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.email().max(255).optional(),
  role: UserRoleSchema.optional(),
});

export const acceptSchema = z.object({
  organization: z.object({
    name: z.string().min(1).max(255),
    description: z.string().min(1).max(ONBOARDING_DESCRIPTION_MAX_LENGTH),
  }),
  goals: z.array(goalSchema).min(1).max(20),
  team: z.array(teamMemberSchema).optional(),
});
