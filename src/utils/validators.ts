
import { z } from 'zod';
import { 
  TaskSchema, 
  TaskUpdateSchema,
  SingleTaskCreationSchema,
  UserInputSchema,
  TodoistApiResponseSchema,
  formatValidationErrors,
  type TaskInput,
  type TaskUpdateInput,
  type SingleTaskCreationInput,
  type UserInput,
  type ValidationError
} from '../schemas/taskSchemas';
import { logger } from './logger';

export class ValidationResult<T> {
  constructor(
    public success: boolean,
    public data?: T,
    public errors?: ValidationError[]
  ) {}

  static success<T>(data: T): ValidationResult<T> {
    return new ValidationResult(true, data);
  }

  static failure<T>(errors: ValidationError[]): ValidationResult<T> {
    return new ValidationResult(false, undefined, errors);
  }
}

export class TaskValidator {
  static validateTaskInput(input: unknown): ValidationResult<TaskInput> {
    try {
      logger.debug('VALIDATION', 'Validating task input', input);
      
      const result = TaskSchema.parse(input);
      
      logger.debug('VALIDATION', 'Task input validation successful', result);
      return ValidationResult.success(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = formatValidationErrors(error);
        logger.warn('VALIDATION', 'Task input validation failed', validationErrors);
        return ValidationResult.failure(validationErrors);
      }
      
      logger.error('VALIDATION', 'Unexpected validation error', error);
      return ValidationResult.failure([{
        field: 'unknown',
        message: 'Unexpected validation error',
        code: 'UNKNOWN_ERROR'
      }]);
    }
  }

  static validateSingleTaskCreation(input: unknown): ValidationResult<SingleTaskCreationInput> {
    try {
      logger.debug('VALIDATION', 'Validating single task creation input', input);
      
      const result = SingleTaskCreationSchema.parse(input);
      
      logger.debug('VALIDATION', 'Single task creation validation successful', result);
      return ValidationResult.success(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = formatValidationErrors(error);
        logger.warn('VALIDATION', 'Single task creation validation failed', validationErrors);
        return ValidationResult.failure(validationErrors);
      }
      
      logger.error('VALIDATION', 'Unexpected single task creation validation error', error);
      return ValidationResult.failure([{
        field: 'unknown',
        message: 'Unexpected validation error',
        code: 'UNKNOWN_ERROR'
      }]);
    }
  }

  static validateTaskUpdate(input: unknown): ValidationResult<TaskUpdateInput> {
    try {
      logger.debug('VALIDATION', 'Validating task update', input);
      
      const result = TaskUpdateSchema.parse(input);
      
      logger.debug('VALIDATION', 'Task update validation successful', result);
      return ValidationResult.success(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = formatValidationErrors(error);
        logger.warn('VALIDATION', 'Task update validation failed', validationErrors);
        return ValidationResult.failure(validationErrors);
      }
      
      logger.error('VALIDATION', 'Unexpected task update validation error', error);
      return ValidationResult.failure([{
        field: 'unknown',
        message: 'Unexpected validation error',
        code: 'UNKNOWN_ERROR'
      }]);
    }
  }

  static validateUserInput(input: string): ValidationResult<UserInput> {
    try {
      logger.debug('VALIDATION', 'Validating user input', { 
        input, 
        inputType: typeof input,
        inputLength: input?.length 
      });
      
      // The schema expects { input: string }, so we wrap the string
      const result = UserInputSchema.parse({ input });
      
      logger.debug('VALIDATION', 'User input validation successful', result);
      return ValidationResult.success(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = formatValidationErrors(error);
        logger.warn('VALIDATION', 'User input validation failed', { 
          input, 
          validationErrors 
        });
        return ValidationResult.failure(validationErrors);
      }
      
      logger.error('VALIDATION', 'Unexpected user input validation error', error);
      return ValidationResult.failure([{
        field: 'unknown',
        message: 'Unexpected validation error',
        code: 'UNKNOWN_ERROR'
      }]);
    }
  }

  static validateTodoistResponse(response: unknown): ValidationResult<any> {
    try {
      logger.debug('VALIDATION', 'Validating Todoist API response', response);
      
      const result = TodoistApiResponseSchema.parse(response);
      
      logger.debug('VALIDATION', 'Todoist response validation successful', result);
      return ValidationResult.success(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = formatValidationErrors(error);
        logger.warn('VALIDATION', 'Todoist response validation failed', validationErrors);
        return ValidationResult.failure(validationErrors);
      }
      
      logger.error('VALIDATION', 'Unexpected Todoist response validation error', error);
      return ValidationResult.failure([{
        field: 'unknown',
        message: 'Unexpected validation error',
        code: 'UNKNOWN_ERROR'
      }]);
    }
  }

  // Content sanitization utilities
  static sanitizeTaskContent(content: string): string {
    let sanitized = content.trim();
    
    // Remove "task:" prefix if present
    if (sanitized.toLowerCase().startsWith('task:')) {
      sanitized = sanitized.substring(5).trim();
      logger.debug('VALIDATION', 'Removed task: prefix from content', { original: content, sanitized });
    }
    
    // Remove multiple consecutive whitespaces
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    // Remove leading/trailing quotes if they wrap the entire content
    if ((sanitized.startsWith('"') && sanitized.endsWith('"')) ||
        (sanitized.startsWith("'") && sanitized.endsWith("'"))) {
      sanitized = sanitized.slice(1, -1).trim();
      logger.debug('VALIDATION', 'Removed wrapping quotes from content', { original: content, sanitized });
    }
    
    return sanitized;
  }

  static validateAndSanitizeTask(input: {
    content: string;
    due_string?: string;
    priority?: number;
    labels?: string[];
  }): ValidationResult<SingleTaskCreationInput> {
    // First sanitize the content
    const sanitizedInput = {
      ...input,
      content: this.sanitizeTaskContent(input.content)
    };
    
    // Then validate using the single task creation schema
    return this.validateSingleTaskCreation(sanitizedInput);
  }
}

// Export convenience functions
export const validateTask = TaskValidator.validateTaskInput;
export const validateSingleTaskCreation = TaskValidator.validateSingleTaskCreation;
export const validateTaskUpdate = TaskValidator.validateTaskUpdate;
export const validateUserInput = TaskValidator.validateUserInput;
export const validateTodoistResponse = TaskValidator.validateTodoistResponse;
export const validateAndSanitizeTask = TaskValidator.validateAndSanitizeTask;
export const sanitizeTaskContent = TaskValidator.sanitizeTaskContent;
