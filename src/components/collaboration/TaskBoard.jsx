import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Circle, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import CCModal from '@/components/ui-custom/CCModal';
import { format } from 'date-fns';

const priorityConfig = {
  low: { label: 'Low', variant: 'default', color: '#6B7A94' },
  medium: { label: 'Medium', variant: 'warning', color: '#F59E0B' },
  high: { label: 'High', variant: 'danger', color: '#EF4444' },
  urgent: { label: 'Urgent', variant: 'danger', color: '#DC2626' },
};

const statusConfig = {
  pending: { label: 'To Do', icon: Circle },
  in_progress: { label: 'In Progress', icon: Clock },
  completed: { label: 'Done', icon: CheckCircle2 },
  blocked: { label: 'Blocked', icon: AlertTriangle },
};

export default function TaskBoard({ dealRoomId, participants, userRole }) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    priority: 'medium',
  });
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', dealRoomId],
    queryFn: () => base44.entities.DealRoomTask.filter({ deal_room_id: dealRoomId }, '-created_date'),
    enabled: !!dealRoomId,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const canManageTasks = userRole?.permissions?.manage_tasks || userRole?.role === 'admin';

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.DealRoomTask.create({
      ...data,
      deal_room_id: dealRoomId,
      created_by: user?.email,
      status: 'pending',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', dealRoomId] });
      toast.success('Task created');
      setCreateModalOpen(false);
      setTaskForm({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DealRoomTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', dealRoomId] });
      toast.success('Task updated');
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => base44.entities.DealRoomTask.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', dealRoomId] });
      toast.success('Task deleted');
    },
  });

  const groupedTasks = {
    pending: tasks.filter(t => t.status === 'pending'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
    blocked: tasks.filter(t => t.status === 'blocked'),
  };

  const handleCreateTask = () => {
    if (!taskForm.title) {
      toast.error('Please enter a task title');
      return;
    }
    createTaskMutation.mutate(taskForm);
  };

  return (
    <div className="space-y-4">
      {canManageTasks && (
        <CCButton
          variant="primary"
          icon={Plus}
          onClick={() => setCreateModalOpen(true)}
          fullWidth
        >
          Add Task
        </CCButton>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([status, config]) => (
          <div key={status} className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#263248]">
              <config.icon className="w-4 h-4 text-[#9AA6BC]" />
              <h3 className="text-sm font-medium text-[#E8EEF9]">{config.label}</h3>
              <CCBadge size="sm" variant="outline">{groupedTasks[status].length}</CCBadge>
            </div>
            
            <div className="space-y-2">
              {groupedTasks[status].map(task => (
                <CCCard key={task.id} padding="sm" hover>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[#E8EEF9] flex-1">{task.title}</p>
                      {canManageTasks && (
                        <button
                          onClick={() => deleteTaskMutation.mutate(task.id)}
                          className="text-[#6B7A94] hover:text-[#EF4444] transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    
                    {task.description && (
                      <p className="text-xs text-[#6B7A94] line-clamp-2">{task.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-1">
                      <CCBadge size="sm" variant={priorityConfig[task.priority]?.variant}>
                        {priorityConfig[task.priority]?.label}
                      </CCBadge>
                      {task.due_date && (
                        <CCBadge size="sm" variant="outline">
                          {format(new Date(task.due_date), 'MMM d')}
                        </CCBadge>
                      )}
                    </div>

                    {canManageTasks && status !== 'completed' && (
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskMutation.mutate({ 
                          id: task.id, 
                          data: { status: e.target.value }
                        })}
                        className="w-full bg-[#0B0F14] border border-[#263248] rounded text-xs text-[#E8EEF9] px-2 py-1"
                      >
                        {Object.entries(statusConfig).map(([s, c]) => (
                          <option key={s} value={s}>{c.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </CCCard>
              ))}
            </div>
          </div>
        ))}
      </div>

      <CCModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Task"
        description="Add a new task to the collaboration"
      >
        <div className="space-y-4">
          <CCInput
            label="Task Title"
            placeholder="Enter task title"
            value={taskForm.title}
            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Description</label>
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              placeholder="Enter task description"
              className="w-full h-24 bg-[#121824] border border-[#263248] rounded-lg text-[#E8EEF9] placeholder-[#6B7A94] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Assign To</label>
            <select
              value={taskForm.assigned_to}
              onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg text-[#E8EEF9] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            >
              <option value="">Unassigned</option>
              {participants?.map(p => (
                <option key={p.user_id} value={p.user_id}>{p.display_name || p.user_id}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CCInput
              label="Due Date"
              type="date"
              value={taskForm.due_date}
              onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
            />

            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Priority</label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg text-[#E8EEF9] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
              >
                {Object.entries(priorityConfig).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <CCButton variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={handleCreateTask}
              loading={createTaskMutation.isPending}
            >
              Create Task
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}