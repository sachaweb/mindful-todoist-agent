
import { z } from 'zod';

// Core task validation schema
export const TaskSchema = z.object({
  content: z
    .string()
    .min(1, 'Task content cannot be empty')
    .max(500, 'Task content must be less than 500 characters')
    .refine(
      (content) => !content.toLowerCase().startsWith('task:'),
      'Task content should not start with "task:" prefix'
    )
    .refine(
      (content) => content.trim().length > 0,
      'Task content cannot be only whitespace'
    ),
  due_string: z
    .string()
    .optional()
    .refine(
      (due) => !due || due.trim().length > 0,
      'Due date cannot be empty string'
    ),
  priority: z
    .number()
    .int()
    .min(1, 'Priority must be between 1 and 4')
    .max(4, 'Priority must be between 1 and 4')
    .optional(),
  labels: z
    .array(
      z.string()
        .min(1, 'Label cannot be empty')
        .max(50, 'Label must be less than 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Label can only contain letters, numbers, underscores, and hyphens')
    )
    .max(10, 'Cannot have more than 10 labels')
    .optional()
});

// Task update schema (for updating existing tasks)
export const TaskUpdateSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  updates: z.object({
    content: z.string().min(1).max(500).optional(),
    due_string: z.string().optional(),
    priority: z.number().int().min(1).max(4).optional(),
    labels: z.array(z.string().min(1).max(50)).max(10).optional()
  })
});

// Single task creation schema - this is what we actually use
export const SingleTaskCreationSchema = z.object({
  content: z.string().min(1, 'Task content cannot be empty'),
  due_string: z.string().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  labels: z.array(z.string()).optional()
});

// Multiple task creation schema
export const MultipleTaskCreationSchema = z.object({
  tasks: z.array(SingleTaskCreationSchema).min(1, 'At least one task is required')
});

// Todoist API response validation
export const TodoistTaskResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  priority: z.number().int().min(1).max(4),
  due: z.object({
    date: z.string(),
    string: z.string().optional(),
    datetime: z.string().optional()
  }).nullable().optional(),
  labels: z.array(z.string()),
  completed: z.boolean(),
  project_id: z.string().optional()
});

export const TodoistApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional()
});

// Input sanitization schema
export const UserInputSchema = z.object({
  input: z
    .string()
    .min(1, 'Input cannot be empty')
    .max(1000, 'Input is too long')
    .transform((input) => {
      // Remove "task:" prefix if present
      let cleaned = input.trim();
      if (cleaned.toLowerCase().startsWith('task:')) {
        cleaned = cleaned.substring(5).trim();
      }
      return cleaned;
    })
});

// Type exports
export type TaskInput = z.infer<typeof TaskSchema>;
export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>;
export type SingleTaskCreationInput = z.infer<typeof SingleTaskCreationSchema>;
export type MultipleTaskCreationInput = z.infer<typeof MultipleTaskCreationSchema>;
export type TodoistTaskResponse = z.infer<typeof TodoistTaskResponseSchema>;
export type TodoistApiResponse = z.infer<typeof TodoistApiResponseSchema>;
export type UserInput = z.infer<typeof UserInputSchema>;

// Validation error types
export type ValidationError = {
  field: string;
  message: string;
  code: string;
};

export const formatValidationErrors = (error: z.ZodError): ValidationError[] => {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));
};
