
import React, { useEffect } from "react";
import TaskList from "./TaskList";
import { useTodoistAgent } from "../context/TodoistAgentContext";
import { useToast } from "@/hooks/use-toast";

const TaskPanel: React.FC = () => {
  const { tasks, isLoading, refreshTasks, completeTask } = useTodoistAgent();
  const { toast } = useToast();
  
  useEffect(() => {
    console.log("TaskPanel rendered with tasks:", tasks);
  }, [tasks]);

  const handleManualRefresh = async () => {
    console.log("Manual refresh requested");
    await refreshTasks();
    toast({
      title: "Tasks Updated",
      description: `Loaded ${tasks.length} tasks from Todoist`,
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Tasks</h2>
        <button
          onClick={handleManualRefresh}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh Tasks"}
        </button>
      </div>
      <TaskList tasks={tasks} onCompleteTask={completeTask} isLoading={isLoading} />
    </div>
  );
};

export default TaskPanel;
