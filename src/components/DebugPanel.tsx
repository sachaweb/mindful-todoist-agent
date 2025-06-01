
import React, { useState, useEffect } from 'react';
import { logger, LogEntry, LogLevel } from '../utils/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Trash2, Eye, EyeOff } from 'lucide-react';

const DebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [debugMode, setDebugMode] = useState(logger.getDebugMode());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all');

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs([...logger.getLogs()]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDebugToggle = (enabled: boolean) => {
    setDebugMode(enabled);
    logger.setDebugMode(enabled);
  };

  const handleClearLogs = () => {
    logger.clearLogs();
    setLogs([]);
  };

  const handleExportLogs = () => {
    const logData = logger.exportLogs();
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todoist-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = selectedLevel === 'all' 
    ? logs 
    : logs.filter(log => log.level === selectedLevel);

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'debug': return 'bg-gray-100 text-gray-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      case 'warn': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLogIcon = (level: LogLevel): string => {
    switch (level) {
      case 'debug': return '🔍';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
      >
        <Eye className="h-4 w-4 mr-1" />
        Debug
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-96 z-50 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Debug Panel</CardTitle>
          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <label htmlFor="debug-mode" className="text-xs font-medium">
            Debug Mode
          </label>
          <Switch
            id="debug-mode"
            checked={debugMode}
            onCheckedChange={handleDebugToggle}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="logs" className="h-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="logs">Logs ({filteredLogs.length})</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>
          
          <TabsContent value="logs" className="h-64">
            <div className="flex items-center gap-2 mb-2">
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as LogLevel | 'all')}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="all">All</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
              <Button onClick={handleClearLogs} variant="outline" size="sm">
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button onClick={handleExportLogs} variant="outline" size="sm">
                <Download className="h-3 w-3" />
              </Button>
            </div>
            
            <ScrollArea className="h-48 border rounded p-2">
              {filteredLogs.slice(-50).map((log, index) => (
                <div key={index} className="mb-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{getLogIcon(log.level)}</span>
                    <Badge className={getLevelColor(log.level)}>{log.level}</Badge>
                    <Badge variant="outline">{log.category}</Badge>
                    <span className="text-gray-500">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="ml-2">
                    <div className="font-medium">{log.message}</div>
                    {log.data && (
                      <pre className="mt-1 text-gray-600 overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                  <Separator className="mt-2" />
                </div>
              ))}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="stats" className="h-64">
            <div className="space-y-2 text-xs">
              <div>Total Logs: {logs.length}</div>
              <div>Debug Mode: {debugMode ? 'ON' : 'OFF'}</div>
              <div className="space-y-1">
                <div>By Level:</div>
                {(['debug', 'info', 'warn', 'error'] as LogLevel[]).map(level => (
                  <div key={level} className="ml-2">
                    {level}: {logs.filter(l => l.level === level).length}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div>By Category:</div>
                {Array.from(new Set(logs.map(l => l.category))).map(category => (
                  <div key={category} className="ml-2">
                    {category}: {logs.filter(l => l.category === category).length}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DebugPanel;
