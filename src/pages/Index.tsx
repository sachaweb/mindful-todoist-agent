import React, { useState, useEffect } from "react";
import { TodoistAgentProvider, useTodoistAgent } from "../context/TodoistAgentContext";
import ChatInterface from "../components/ChatInterface";
import ClaudeApiKeyForm from "../components/ClaudeApiKeyForm";
import TaskPanel from "../components/TaskPanel";
import aiService from "../services/ai-service";

// Separate component to use the context
const MainContent: React.FC = () => {
  const { isLoading } = useTodoistAgent();
  const [claudeApiKeySet, setClaudeApiKeySet] = useState(false);
  
  useEffect(() => {
    setClaudeApiKeySet(aiService.hasApiKey());
  }, []);

  const handleClaudeApiKey = (apiKey: string) => {
    aiService.setApiKey(apiKey);
    setClaudeApiKeySet(true);
  };
  
  // Show Claude API key form first if not set
  if (!claudeApiKeySet) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <ClaudeApiKeyForm onSubmit={handleClaudeApiKey} isLoading={false} />
      </div>
    );
  }

  // Show main interface when Claude API key is set (Todoist is handled by Edge Function)
  return (
    <>
      <div className="flex-1 md:w-3/4 h-full md:border-r overflow-hidden">
        <ChatInterface />
      </div>
      <div className="w-full md:w-1/4 p-4 overflow-auto">
        <TaskPanel />
      </div>
    </>
  );
};

const TodoistAgentApp: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-md bg-todoist-red flex items-center justify-center mr-2">
            <span className="text-white font-bold">T</span>
          </div>
          <h1 className="text-xl font-bold">Todoist AI Assistant</h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <TodoistAgentProvider>
          <MainContent />
        </TodoistAgentProvider>
      </div>
    </div>
  );
};

const Index: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TodoistAgentApp />
    </div>
  );
};

export default Index;
