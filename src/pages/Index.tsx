
import React from "react";
import { TodoistAgentProvider } from "../context/TodoistAgentContext";
import ChatInterface from "../components/ChatInterface";
import ApiKeyForm from "../components/ApiKeyForm";
import TaskPanel from "../components/TaskPanel";
import { useTodoistAgent } from "../context/TodoistAgentContext";

const TodoistAgentApp: React.FC = () => {
  const { apiKeySet, isLoading, setApiKey } = useTodoistAgent();

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
        {!apiKeySet ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <ApiKeyForm onSubmit={setApiKey} isLoading={isLoading} />
          </div>
        ) : (
          <>
            <div className="flex-1 md:w-3/4 h-full md:border-r overflow-hidden">
              <ChatInterface />
            </div>
            <div className="w-full md:w-1/4 p-4 overflow-auto">
              <TaskPanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Index = () => {
  return (
    <TodoistAgentProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <TodoistAgentApp />
      </div>
    </TodoistAgentProvider>
  );
};

export default Index;
