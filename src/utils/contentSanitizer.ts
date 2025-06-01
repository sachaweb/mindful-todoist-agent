
import { logger } from "./logger";

export interface SanitizationRule {
  name: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  description: string;
  enabled: boolean;
}

export interface SanitizationResult {
  original: string;
  sanitized: string;
  rulesApplied: string[];
  hasChanges: boolean;
}

class ContentSanitizer {
  private rules: SanitizationRule[] = [
    // Remove common prefixes that pollute task content
    {
      name: 'remove_task_prefix',
      pattern: /^(?:task:|create:|title:|todo:)\s*/i,
      replacement: '',
      description: 'Remove task creation prefixes',
      enabled: true
    },
    
    // Remove confirmation artifacts
    {
      name: 'remove_confirmation_artifacts',
      pattern: /^(?:create anyway|proceed|confirm|yes,?\s*)?(.+)/i,
      replacement: '$1',
      description: 'Remove confirmation response artifacts',
      enabled: true
    },
    
    // Remove list markers and numbering
    {
      name: 'remove_list_markers',
      pattern: /^(?:\d+\.\s*|[-*•]\s*)/,
      replacement: '',
      description: 'Remove list markers and numbering',
      enabled: true
    },
    
    // Clean up quote wrapping
    {
      name: 'remove_quote_wrapping',
      pattern: /^["'](.+?)["']$/,
      replacement: '$1',
      description: 'Remove wrapping quotes',
      enabled: true
    },
    
    // Normalize whitespace
    {
      name: 'normalize_whitespace',
      pattern: /\s+/g,
      replacement: ' ',
      description: 'Normalize multiple whitespaces to single space',
      enabled: true
    },
    
    // Remove AI response artifacts
    {
      name: 'remove_ai_artifacts',
      pattern: /^(?:I'll create (?:a )?task\s*["""]?|I'll create the following \d+ tasks?:?\s*)/i,
      replacement: '',
      description: 'Remove AI response formatting artifacts',
      enabled: true
    },
    
    // Clean up action prefixes
    {
      name: 'remove_action_prefixes',
      pattern: /^(?:add|create|make|do|schedule)\s+(?:a\s+)?(?:task\s+)?(?:to\s+)?/i,
      replacement: '',
      description: 'Remove action verb prefixes',
      enabled: true
    }
  ];

  public sanitize(content: string, ruleNames?: string[]): SanitizationResult {
    if (!content || typeof content !== 'string') {
      logger.warn('SANITIZER', 'Invalid content provided for sanitization', { content });
      return {
        original: content || '',
        sanitized: content || '',
        rulesApplied: [],
        hasChanges: false
      };
    }

    const original = content;
    let sanitized = content.trim();
    const rulesApplied: string[] = [];

    // Apply rules in order
    const applicableRules = ruleNames 
      ? this.rules.filter(rule => ruleNames.includes(rule.name) && rule.enabled)
      : this.rules.filter(rule => rule.enabled);

    for (const rule of applicableRules) {
      const beforeApplication = sanitized;
      
      try {
        if (typeof rule.replacement === 'function') {
          sanitized = sanitized.replace(rule.pattern, rule.replacement);
        } else {
          sanitized = sanitized.replace(rule.pattern, rule.replacement);
        }

        if (beforeApplication !== sanitized) {
          rulesApplied.push(rule.name);
          logger.debug('SANITIZER', `Rule applied: ${rule.name}`, {
            before: beforeApplication,
            after: sanitized,
            rule: rule.description
          });
        }
      } catch (error) {
        logger.error('SANITIZER', `Error applying rule: ${rule.name}`, error);
      }
    }

    // Final trim
    sanitized = sanitized.trim();

    const result: SanitizationResult = {
      original,
      sanitized,
      rulesApplied,
      hasChanges: original !== sanitized
    };

    if (result.hasChanges) {
      logger.info('SANITIZER', 'Content sanitized', {
        original,
        sanitized,
        rulesApplied: rulesApplied.length
      });
    }

    return result;
  }

  public addRule(rule: SanitizationRule): void {
    // Check if rule with same name exists
    const existingIndex = this.rules.findIndex(r => r.name === rule.name);
    
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule;
      logger.info('SANITIZER', `Updated sanitization rule: ${rule.name}`);
    } else {
      this.rules.push(rule);
      logger.info('SANITIZER', `Added new sanitization rule: ${rule.name}`);
    }
  }

  public removeRule(ruleName: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(rule => rule.name !== ruleName);
    
    const removed = this.rules.length < initialLength;
    if (removed) {
      logger.info('SANITIZER', `Removed sanitization rule: ${ruleName}`);
    }
    
    return removed;
  }

  public toggleRule(ruleName: string, enabled?: boolean): boolean {
    const rule = this.rules.find(r => r.name === ruleName);
    
    if (!rule) {
      logger.warn('SANITIZER', `Rule not found: ${ruleName}`);
      return false;
    }

    rule.enabled = enabled !== undefined ? enabled : !rule.enabled;
    logger.info('SANITIZER', `Rule ${rule.enabled ? 'enabled' : 'disabled'}: ${ruleName}`);
    
    return true;
  }

  public getRules(): SanitizationRule[] {
    return [...this.rules];
  }

  public sanitizeForTodoist(data: {
    content?: string;
    due_string?: string;
    labels?: string[];
  }): typeof data {
    const result = { ...data };

    // Sanitize content
    if (result.content) {
      const sanitized = this.sanitize(result.content);
      result.content = sanitized.sanitized;
    }

    // Sanitize due string
    if (result.due_string) {
      const sanitized = this.sanitize(result.due_string, ['normalize_whitespace']);
      result.due_string = sanitized.sanitized;
    }

    // Sanitize labels
    if (result.labels && Array.isArray(result.labels)) {
      result.labels = result.labels.map(label => {
        const sanitized = this.sanitize(label, ['normalize_whitespace', 'remove_quote_wrapping']);
        return sanitized.sanitized;
      }).filter(label => label.length > 0);
    }

    return result;
  }
}

export const contentSanitizer = new ContentSanitizer();
