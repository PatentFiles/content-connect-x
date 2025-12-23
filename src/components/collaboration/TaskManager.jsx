import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Circle, Clock, AlertCircle, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import CCButton from '../ui-custom/CCButton';
import CCCard from '../ui-custom/CCCard';
import CCInput from '../ui-custom/CCInput';
import CCSelect from '../ui-custom/CCSelect';
import CCBadge from '../ui-custom/CCBadge';
import CCModal from '../ui-custom/CCModal';
import { toast } from 'sonner';

export default function TaskManager({ dealRoomId, participants }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    priority: 'medium',
  });
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['collaborationTasks', dealRoomId],
    queryFn: () => base44.entities.CollaborationTask.filter({ deal_room_id: dealRoomId }),
    enabled: !!dealRoomId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['participantProfiles', participants],
    queryFn: async () => {
      if (!participants?.length) return [];
      return await Promise.all(
        participants.map(id => base44.entities.UserProfile.filter({ user_id: id }).then(p => p[0]))
      );
    },
    enabled: !!participants?.length,
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.CollaborationTask.create({
      ...data,
      deal_room_id: dealRoomId,
      created_by: user?.email,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['collaborationTasks']);
      setShowAddModal(false);
      setNewTask({
        title: '',
        description: '',
        assigned_to: '',
        due_date: '',
        priority: 'medium',
      });
      toast.success('Task created');
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CollaborationTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['collaborationTasks']);
    },
  });

  const getProfileByUserId = (userId) => {
    return profiles.find(p => p?.user_id === userId);
  };

  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  const priorityColors = {
    low: 'default',
    medium: 'warning',
    high: 'danger',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#E8EEF9]">Tasks</h3>
        <CCButton variant="primary" size="sm" icon={Plus} onClick={() => setShowAddModal(true)}>
          Add Task
        </CCButton>
      </div>

      <div className="space-y-4">
        {/* To Do */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Circle className="w-4 h-4 text-[#6B7A94]" />
            <span className="text-sm font-medium text-[#9AA6BC]">To Do ({tasksByStatus.todo.length})</span>
          </div>
          <div className="space-y-2">
            {tasksByStatus.todo.map(task => {
              const assignee = getProfileByUserId(task.assigned_to);
              return (
                <motion.div key={task.id} layout>
                  <CCCard padding="md" hover>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-[#E8EEF9]">{task.title}</h4>
                          <CCBadge variant={priorityColors[task.priority]} size="sm">
                            {task.priority}
                          </CCBadge>
                        </div>
                        {task.description && (
                          <p className="text-xs text-[#9AA6BC] mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-[#6B7A94]">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{assignee?.display_name || 'Unassigned'}</span>
                          </div>
                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{format(new Date(task.due_date), 'MMM d')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <CCButton
                        variant="outline"
                        size="sm"
                        onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: 'in_progress' } })}
                      >
                        Start
                      </CCButton>
                    </div>
                  </CCCard>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* In Progress */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-[#4F8CFF]" />
            <span className="text-sm font-medium text-[#9AA6BC]">In Progress ({tasksByStatus.in_progress.length})</span>
          </div>
          <div className="space-y-2">
            {tasksByStatus.in_progress.map(task => {
              const assignee = getProfileByUserId(task.assigned_to);
              return (
                <motion.div key={task.id} layout>
                  <CCCard padding="md" hover className="border-[#4F8CFF]/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-[#E8EEF9]">{task.title}</h4>
                          <CCBadge variant={priorityColors[task.priority]} size="sm">
                            {task.priority}
                          </CCBadge>
                        </div>
                        {task.description && (
                          <p className="text-xs text-[#9AA6BC] mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-[#6B7A94]">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{assignee?.display_name || 'Unassigned'}</span>
                          </div>
                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{format(new Date(task.due_date), 'MMM d')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <CCButton
                        variant="success"
                        size="sm"
                        icon={CheckCircle2}
                        onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: 'completed' } })}
                      >
                        Done
                      </CCButton>
                    </div>
                  </CCCard>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Completed */}
        {tasksByStatus.completed.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              <span className="text-sm font-medium text-[#9AA6BC]">Completed ({tasksByStatus.completed.length})</span>
            </div>
            <div className="space-y-2">
              {tasksByStatus.completed.map(task => {
                const assignee = getProfileByUserId(task.assigned_to);
                return (
                  <motion.div key={task.id} layout>
                    <CCCard padding="md" className="opacity-60">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-[#22C55E] mt-1" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-[#E8EEF9] line-through">{task.title}</h4>
                          <div className="flex items-center gap-3 text-xs text-[#6B7A94] mt-1">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{assignee?.display_name || 'Unassigned'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CCCard>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      <CCModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Task"
        size="md"
      >
        <div className="space-y-4">
          <CCInput
            label="Task Title"
            placeholder="What needs to be done?"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Description</label>
            <textarea
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px]"
              placeholder="Task description..."
            />
          </div>

          <CCSelect
            label="Assign To"
            value={newTask.assigned_to}
            onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
            required
          >
            <option value="">Select assignee</option>
            {profiles.map(profile => (
              <option key={profile?.user_id} value={profile?.user_id}>
                {profile?.display_name || profile?.user_id}
              </option>
            ))}
          </CCSelect>

          <div className="grid grid-cols-2 gap-3">
            <CCInput
              label="Due Date"
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
            />
            <CCSelect
              label="Priority"
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </CCSelect>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <CCButton variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={() => createTaskMutation.mutate(newTask)}
              loading={createTaskMutation.isPending}
              disabled={!newTask.title || !newTask.assigned_to}
            >
              Create Task
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}