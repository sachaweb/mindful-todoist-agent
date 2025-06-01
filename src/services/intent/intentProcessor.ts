
import { TodoistTask } from "../../types";
import { logger } from "../../utils/logger";
import { intentService, type IntentResult } from "../intentService";
import { contentSanitizer } from "../../utils/contentSanitizer";

export class IntentProcessor {
  public async processIntent(intent: IntentResult, tasks: TodoistTask[]): Promise<any> {
    logger.info('INTENT_PROCESSOR', 'Processing intent for task operations', intent);

    // Map intent to Todoist format
    const todoistData = intentService.mapToTodoistFormat(intent);
    
    // Apply sanitization as final safety net
    if (todoistData.action === 'create') {
      const sanitized = contentSanitizer.sanitizeForTodoist({
        content: todoistData.content,
        due_string: todoistData.due_string,
        labels: todoistData.labels
      });
      
      return {
        action: 'create',
        ...sanitized
      };
    }

    if (todoistData.action === 'create_multiple') {
      const sanitizedTasks = todoistData.tasks.map((task: any) => 
        contentSanitizer.sanitizeForTodoist(task)
      );
      
      return {
        action: 'create_multiple',
        tasks: sanitizedTasks
      };
    }

    return todoistData;
  }
}
