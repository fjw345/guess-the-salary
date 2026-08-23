import { z } from 'zod';
import { salaryBases, salaryPeriods } from './salary.js';

export const degrees = ['专科', '本科', '硕士', '博士'] as const;
export const reviewStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const answerSchema = z.object({
  guessAmount: z.number().int().positive().max(8_000_000),
  guessPeriod: z.enum(salaryPeriods),
});

export const submissionSchema = z.object({
  degree: z.enum(degrees),
  schoolNameRaw: z.string().trim().min(2).max(80),
  major: z.string().trim().min(1).max(80),
  tenureText: z.string().trim().min(1).max(40),
  city: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1).max(80),
  position: z.string().trim().min(1).max(80),
  salaryAmount: z.number().int().positive(),
  salaryPeriod: z.enum(salaryPeriods).exclude(['UNKNOWN']),
  salaryBasis: z.enum(salaryBases).exclude(['UNKNOWN']),
  salaryIsIntern: z.boolean().default(false),
  authorNote: z.string().trim().min(2).max(500),
  privacyConfirmed: z.literal(true),
  captchaToken: z.string().min(1),
  captchaAnswer: z.number().int(),
  website: z.string().max(0).optional(),
});

export const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectReason: z.string().trim().max(240).optional(),
  authorNote: z.string().trim().max(500).optional(),
  schoolId: z.number().int().positive().nullable().optional(),
  salaryPeriod: z.enum(salaryPeriods).optional(),
  salaryBasis: z.enum(salaryBases).optional(),
  hideSchool: z.boolean().optional(),
  hideCompany: z.boolean().optional(),
});

export const reportSchema = z.object({
  reason: z.enum(['IDENTITY_LEAK', 'FALSE_INFO', 'OFFENSIVE', 'OTHER']),
  details: z.string().trim().min(5).max(500),
  roundId: z.string().trim().min(1).max(100).optional(),
  website: z.string().max(0).optional(),
});

export type AnswerInput = z.infer<typeof answerSchema>;
export type SubmissionInput = z.infer<typeof submissionSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
