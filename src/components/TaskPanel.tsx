
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

  const handleRefresh = async () => {
    console.log("Manually refreshing tasks");
    await refreshTasks();
    // Show toast only for manual refresh
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
          onClick={handleRefresh}
          className="text-xs text-gray-500 hover:text-todoist-red flex items-center disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>
      <TaskList tasks={tasks} onCompleteTask={completeTask} isLoading={isLoading} />
    </div>
  );
};

export default TaskPanel;
