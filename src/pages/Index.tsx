
import React, { useState, useEffect } from "react";
import { TodoistAgentProvider, useTodoistAgent } from "../context/TodoistAgentContext";
import ChatInterface from "../components/ChatInterface";
import ClaudeApiKeyForm from "../components/ClaudeApiKeyForm";
import TaskPanel from "../components/TaskPanel";
import ErrorBoundary from "../components/ErrorBoundary";
import LoadingWrapper from "../components/LoadingWrapper";
import aiService from "../services/ai-service";

// Separate component for Claude API key management (outside of Todoist context)
const ClaudeApiKeyManager: React.FC<{ onApiKeySet: () => void }> = ({ onApiKeySet }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClaudeApiKey = (apiKey: string) => {
    setIsLoading(true);
    try {
      aiService.setApiKey(apiKey);
      onApiKeySet();
    } catch (error) {
      console.error("Error setting Claude API key:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <ClaudeApiKeyForm onSubmit={handleClaudeApiKey} isLoading={isLoading} />
    </div>
  );
};

// Main content component that uses the Todoist context
const MainContent: React.FC = () => {
  const { isLoading } = useTodoistAgent();

  return (
    <ErrorBoundary>
      <div className="flex-1 md:w-3/4 h-full md:border-r overflow-hidden">
        <ChatInterface />
      </div>
      <div className="w-full md:w-1/4 p-4 overflow-auto">
        <TaskPanel />
      </div>
    </ErrorBoundary>
  );
};

// App content that manages the overall state
const AppContent: React.FC = () => {
  const [claudeApiKeySet, setClaudeApiKeySet] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  
  useEffect(() => {
    // Check if Claude API key is already set
    const checkApiKey = async () => {
      try {
        const hasKey = aiService.hasApiKey();
        setClaudeApiKeySet(hasKey);
      } catch (error) {
        console.error("Error checking Claude API key:", error);
        setClaudeApiKeySet(false);
      } finally {
        setIsCheckingApiKey(false);
      }
    };
    
    checkApiKey();
  }, []);

  const handleClaudeApiKeySet = () => {
    setClaudeApiKeySet(true);
  };

  return (
    <LoadingWrapper isLoading={isCheckingApiKey} loadingMessage="Checking API configuration...">
      {!claudeApiKeySet ? (
        <ClaudeApiKeyManager onApiKeySet={handleClaudeApiKeySet} />
      ) : (
        <ErrorBoundary>
          <TodoistAgentProvider>
            <MainContent />
          </TodoistAgentProvider>
        </ErrorBoundary>
      )}
    </LoadingWrapper>
  );
};

const TodoistAgentApp: React.FC = () => {
  return (
    <ErrorBoundary>
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
          <AppContent />
        </div>
      </div>
    </ErrorBoundary>
  );
};

const Index: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-background">
        <TodoistAgentApp />
      </div>
    </ErrorBoundary>
  );
};

export default Index;
