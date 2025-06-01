export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  userId?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private debugMode = false;

  constructor() {
    // Load debug mode from localStorage
    this.debugMode = localStorage.getItem('todoist_debug_mode') === 'true';
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    localStorage.setItem('todoist_debug_mode', enabled.toString());
    this.info('Logger', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  getDebugMode(): boolean {
    return this.debugMode;
  }

  private addLog(level: LogLevel, category: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined
    };

    this.logs.push(entry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with formatting
    const timestamp = entry.timestamp.toISOString();
    const categoryPrefix = `[${category}]`;
    
    switch (level) {
      case 'debug':
        if (this.debugMode) {
          console.debug(`🔍 ${timestamp} ${categoryPrefix} ${message}`, data || '');
        }
        break;
      case 'info':
        console.info(`ℹ️ ${timestamp} ${categoryPrefix} ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`⚠️ ${timestamp} ${categoryPrefix} ${message}`, data || '');
        break;
      case 'error':
        console.error(`❌ ${timestamp} ${categoryPrefix} ${message}`, data || '');
        break;
    }
  }

  debug(category: string, message: string, data?: any): void {
    this.addLog('debug', category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.addLog('info', category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.addLog('warn', category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.addLog('error', category, message, data);
  }

  // Critical logging points as specified
  logUserInput(input: string): void {
    this.info('USER_INPUT', 'Raw user input received', { input });
  }

  logClaudeRequest(request: any): void {
    this.debug('CLAUDE_API', 'Request sent to Claude', request);
  }

  logClaudeResponse(response: any): void {
    this.debug('CLAUDE_API', 'Response received from Claude', response);
  }

  logStateTransition(from: string, to: string, context?: any): void {
    this.info('STATE', `Transition: ${from} → ${to}`, context);
  }

  logTodoistCall(action: string, payload?: any): void {
    this.info('TODOIST_API', `API call: ${action}`, payload);
  }

  logTodoistResponse(action: string, response: any): void {
    this.debug('TODOIST_API', `API response: ${action}`, response);
  }

  getLogs(level?: LogLevel, category?: string): LogEntry[] {
    return this.logs.filter(log => {
      if (level && log.level !== level) return false;
      if (category && log.category !== category) return false;
      return true;
    });
  }

  clearLogs(): void {
    this.logs = [];
    this.info('Logger', 'Logs cleared');
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Singleton instance
export const logger = new Logger();
