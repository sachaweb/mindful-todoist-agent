
import React, { useEffect } from "react";
import TaskList from "./TaskList";
import { useTodoistAgent } from "../context/TodoistAgentContext";

const TaskPanel: React.FC = () => {
  const { tasks, isLoading, refreshTasks, completeTask } = useTodoistAgent();
  
  useEffect(() => {
    console.log("TaskPanel rendered with tasks:", tasks);
  }, [tasks]);

  const handleRefresh = () => {
    console.log("Manually refreshing tasks");
    refreshTasks();
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
