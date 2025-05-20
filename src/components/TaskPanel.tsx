
import React, { useContext } from "react";
import TaskList from "./TaskList";
import { TodoistAgentContext } from "../context/TodoistAgentContext";

const TaskPanel: React.FC = () => {
  const context = useContext(TodoistAgentContext);
  
  if (!context) {
    throw new Error("TaskPanel must be used within TodoistAgentProvider");
  }
  
  const { tasks, isLoading, refreshTasks, completeTask } = context;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Tasks</h2>
        <button
          onClick={() => refreshTasks()}
          className="text-xs text-gray-500 hover:text-todoist-red flex items-center"
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>
      <TaskList tasks={tasks} onCompleteTask={completeTask} />
    </div>
  );
};

export default TaskPanel;
