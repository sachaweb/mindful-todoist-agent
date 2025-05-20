
import React from "react";
import TaskList from "./TaskList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoistAgent } from "../context/TodoistAgentContext";
import { ArrowRight } from "lucide-react";

const TaskPanel: React.FC = () => {
  const { tasks, isLoading, refreshTasks, completeTask, sendMessage } = useTodoistAgent();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Your Tasks</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={refreshTasks}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <TaskList 
          tasks={tasks} 
          onCompleteTask={completeTask} 
          isLoading={isLoading} 
        />
        
        <Button
          variant="link"
          size="sm"
          className="mt-4 text-todoist-red"
          onClick={() => sendMessage("Create a new task")}
        >
          Create New Task <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default TaskPanel;
