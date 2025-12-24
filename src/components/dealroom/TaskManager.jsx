import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import { 
  CheckCircle2, Circle, Clock, AlertCircle, Plus, 
  ChevronRight, Calendar, User 
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function TaskManager({ collaborationId, tasks, profiles, user }) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    priority: 'medium',
    parent_task_id: null,
  });
  const queryClient = useQueryClient();

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.DealRoomTask.create({
      ...data,
      deal_room_id: collaborationId,
      created_by: user.email,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['collaborationTasks']);
      setNewTask({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium', parent_task_id: null });
      setShowTaskForm(false);
      toast.success('Task created');
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DealRoomTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['collaborationTasks']);
    },
  });

  const mainTasks = tasks.filter(t => !t.parent_task_id);
  const getSubtasks = (parentId) => tasks.filter(t => t.parent_task_id === parentId);

  const statusColors = {
    pending: 'text-[#6B7A94]',
    in_progress: 'text-[#4F8CFF]',
    completed: 'text-[#22C55E]',
    blocked: 'text-[#EF4444]',
  };

  const priorityColors = {
    low: 'default',
    medium: 'primary',
    high: 'warning',
    urgent: 'danger',
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return CheckCircle2;
      case 'in_progress': return Clock;
      case 'blocked': return AlertCircle;
      default: return Circle;
    }
  };

  const renderTask = (task, isSubtask = false) => {
    const assignee = profiles.find(p => p.user_id === task.assigned_to);
    const subtasks = getSubtasks(task.id);
    const StatusIcon = getStatusIcon(task.status);

    return (
      <div key={task.id}>
        <CCCard className={`p-4 ${isSubtask ? 'ml-8 mt-2' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <button
                onClick={() => {
                  const nextStatus = task.status === 'completed' ? 'pending' : 
                                   task.status === 'pending' ? 'in_progress' : 'completed';
                  updateTaskMutation.mutate({
                    id: task.id,
                    data: { status: nextStatus }
                  });
                }}
                className="mt-1"
              >
                <StatusIcon className={`w-5 h-5 ${statusColors[task.status]}`} />
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-[#6B7A94]' : 'text-[#E8EEF9]'}`}>
                    {task.title}
                  </p>
                  <CCBadge variant={priorityColors[task.priority]} size="sm">
                    {task.priority}
                  </CCBadge>
                </div>
                {task.description && (
                  <p className="text-xs text-[#6B7A94] mb-2">{task.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-[#6B7A94]">
                  {assignee && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {assignee.display_name}
                    </span>
                  )}
                  {task.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(task.due_date), 'MMM d')}
                    </span>
                  )}
                  {subtasks.length > 0 && (
                    <CCBadge variant="outline" size="sm">
                      {subtasks.filter(s => s.status === 'completed').length}/{subtasks.length} subtasks
                    </CCBadge>
                  )}
                </div>
              </div>
            </div>
            {!isSubtask && (
              <CCButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNewTask({ ...newTask, parent_task_id: task.id });
                  setShowTaskForm(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </CCButton>
            )}
          </div>
        </CCCard>
        {subtasks.map(st => renderTask(st, true))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <CCButton
          variant="primary"
          icon={Plus}
          onClick={() => {
            setNewTask({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium', parent_task_id: null });
            setShowTaskForm(!showTaskForm);
          }}
        >
          New Task
        </CCButton>
      </div>

      {showTaskForm && (
        <CCCard className="p-4">
          <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3">
            {newTask.parent_task_id ? 'Create Subtask' : 'Create Task'}
          </h3>
          <div className="space-y-3">
            <CCInput
              label="Task Title"
              placeholder="Enter task title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
            <CCInput
              label="Description"
              placeholder="Task description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[#9AA6BC] mb-1 block">Assign To</label>
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                  className="w-full bg-[#151D2B] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9]"
                >
                  <option value="">Select participant</option>
                  {profiles.map(p => (
                    <option key={p.user_id} value={p.user_id}>{p.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-[#9AA6BC] mb-1 block">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full bg-[#151D2B] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <CCInput
              label="Due Date"
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
            />
            <div className="flex gap-2">
              <CCButton variant="primary" onClick={() => createTaskMutation.mutate(newTask)}>
                Create
              </CCButton>
              <CCButton variant="outline" onClick={() => setShowTaskForm(false)}>
                Cancel
              </CCButton>
            </div>
          </div>
        </CCCard>
      )}

      <div className="space-y-3">
        {mainTasks.length === 0 ? (
          <CCCard className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">No tasks yet</p>
          </CCCard>
        ) : (
          mainTasks.map(task => renderTask(task))
        )}
      </div>
    </div>
  );
}