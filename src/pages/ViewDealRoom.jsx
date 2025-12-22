import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Send, Paperclip, FileText, CheckCircle2, 
  Circle, Clock, Upload, Download, Users, Plus, X,
  Calendar, Flag, MoreVertical
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import { CCAvatarGroup } from '@/components/ui-custom/CCAvatars';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ViewDealRoom() {
  const [activeTab, setActiveTab] = useState('chat');
  const [message, setMessage] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', due_date: '' });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const dealRoomId = urlParams.get('id');

  // Fetch deal room
  const { data: dealRoom, isLoading: roomLoading } = useQuery({
    queryKey: ['dealRoom', dealRoomId],
    queryFn: async () => {
      const rooms = await base44.entities.DealRoom.list();
      return rooms.find(r => r.id === dealRoomId);
    },
    enabled: !!dealRoomId,
  });

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Fetch profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['dealRoomProfiles', dealRoom?.participant_ids],
    queryFn: async () => {
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => dealRoom.participant_ids?.includes(p.user_id));
    },
    enabled: !!dealRoom?.participant_ids,
  });

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ['dealRoomMessages', dealRoomId],
    queryFn: () => base44.entities.DealRoomMessage.filter({ deal_room_id: dealRoomId }, '-created_date'),
    enabled: !!dealRoomId,
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Fetch files
  const { data: files = [] } = useQuery({
    queryKey: ['dealRoomFiles', dealRoomId],
    queryFn: () => base44.entities.DealRoomFile.filter({ deal_room_id: dealRoomId, is_latest: true }, '-created_date'),
    enabled: !!dealRoomId,
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['dealRoomTasks', dealRoomId],
    queryFn: () => base44.entities.DealRoomTask.filter({ deal_room_id: dealRoomId }, '-created_date'),
    enabled: !!dealRoomId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data) => base44.entities.DealRoomMessage.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dealRoomMessages']);
      setMessage('');
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return base44.entities.DealRoomFile.create({
        deal_room_id: dealRoomId,
        uploaded_by: user.email,
        file_name: file.name,
        file_url,
        file_type: file.type,
        file_size: file.size,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dealRoomFiles']);
      toast.success('File uploaded');
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.DealRoomTask.create({
      ...data,
      deal_room_id: dealRoomId,
      created_by: user.email,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['dealRoomTasks']);
      setNewTask({ title: '', description: '', assigned_to: '', due_date: '' });
      setShowTaskForm(false);
      toast.success('Task created');
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DealRoomTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dealRoomTasks']);
    },
  });

  // Create contract mutation
  const createContractMutation = useMutation({
    mutationFn: async () => {
      return base44.entities.Contract.create({
        deal_room_id: dealRoomId,
        template_type: 'creator_to_creator',
        status: 'draft',
        content: {
          title: `Deal Room Contract - ${dealRoom.scene_type || 'Collaboration'}`,
          parties: dealRoom.participant_ids?.map(id => {
            const profile = profiles.find(p => p.user_id === id);
            return { user_id: id, name: profile?.display_name };
          }),
        },
      });
    },
    onSuccess: (contract) => {
      toast.success('Contract created');
      window.location.href = createPageUrl(`ViewContract?id=${contract.id}`);
    },
  });

  const handleSendMessage = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate({
      deal_room_id: dealRoomId,
      sender_id: user.email,
      message: message.trim(),
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    await uploadFileMutation.mutateAsync(file);
    setUploading(false);
  };

  const handleCreateTask = () => {
    if (!newTask.title) return;
    createTaskMutation.mutate(newTask);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (roomLoading) return <CCLoadingScreen />;
  if (!dealRoom) return <CCEmpty title="Deal room not found" />;

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link to={createPageUrl('DealRooms')}>
                <CCButton variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </CCButton>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-[#E8EEF9]">
                  {dealRoom.scene_type || 'Deal Room'}
                </h1>
                <div className="flex items-center gap-2 text-xs text-[#6B7A94]">
                  <CCAvatarGroup avatars={profiles.map(p => ({ src: p.avatar_url, alt: p.display_name }))} max={3} />
                  <span>{profiles.length} participants</span>
                </div>
              </div>
            </div>
            <CCButton variant="primary" onClick={() => createContractMutation.mutate()}>
              Create Contract
            </CCButton>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {['chat', 'files', 'tasks', 'details'].map((tab) => (
              <CCButton
                key={tab}
                variant={activeTab === tab ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </CCButton>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[calc(100vh-300px)]">
            <CCCard className="flex-1 overflow-y-auto mb-4 p-4">
              {messages.length === 0 ? (
                <CCEmpty icon={Send} title="No messages yet" description="Start the conversation" />
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const sender = profiles.find(p => p.user_id === msg.sender_id);
                    const isMe = msg.sender_id === user?.email;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${isMe ? 'bg-[#4F8CFF]' : 'bg-[#263248]'} rounded-lg p-3`}>
                          {!isMe && (
                            <p className="text-xs text-[#9AA6BC] mb-1">{sender?.display_name}</p>
                          )}
                          <p className="text-sm text-white">{msg.message}</p>
                          <p className="text-xs text-[#9AA6BC] mt-1">
                            {format(new Date(msg.created_date), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </CCCard>
            <div className="flex gap-2">
              <CCInput
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
              />
              <CCButton variant="primary" onClick={handleSendMessage} disabled={!message.trim()}>
                <Send className="w-4 h-4" />
              </CCButton>
            </div>
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div>
            <div className="mb-4">
              <label className="cursor-pointer">
                <CCButton variant="primary" icon={Upload} loading={uploading}>
                  Upload File
                </CCButton>
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <div className="grid gap-3">
              {files.length === 0 ? (
                <CCEmpty icon={FileText} title="No files yet" description="Upload documents to share" />
              ) : (
                files.map((file) => {
                  const uploader = profiles.find(p => p.user_id === file.uploaded_by);
                  return (
                    <CCCard key={file.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-[#4F8CFF]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#E8EEF9]">{file.file_name}</p>
                            <p className="text-xs text-[#6B7A94]">
                              v{file.version} • {uploader?.display_name} • {format(new Date(file.created_date), 'MMM d')}
                            </p>
                          </div>
                        </div>
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                          <CCButton variant="ghost" size="sm" icon={Download}>
                            Download
                          </CCButton>
                        </a>
                      </div>
                    </CCCard>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div>
            <div className="mb-4">
              <CCButton variant="primary" icon={Plus} onClick={() => setShowTaskForm(!showTaskForm)}>
                New Task
              </CCButton>
            </div>

            {showTaskForm && (
              <CCCard className="p-4 mb-4">
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
                    <CCInput
                      label="Due Date"
                      type="date"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <CCButton variant="primary" onClick={handleCreateTask}>Create</CCButton>
                    <CCButton variant="outline" onClick={() => setShowTaskForm(false)}>Cancel</CCButton>
                  </div>
                </div>
              </CCCard>
            )}

            <div className="space-y-3">
              {tasks.length === 0 ? (
                <CCEmpty icon={CheckCircle2} title="No tasks yet" description="Create tasks to track progress" />
              ) : (
                tasks.map((task) => {
                  const assignee = profiles.find(p => p.user_id === task.assigned_to);
                  const statusIcon = task.status === 'completed' ? CheckCircle2 : 
                                   task.status === 'in_progress' ? Clock : Circle;
                  return (
                    <CCCard key={task.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            onClick={() => updateTaskMutation.mutate({
                              id: task.id,
                              data: { status: task.status === 'completed' ? 'pending' : 'completed' }
                            })}
                            className="mt-1"
                          >
                            {React.createElement(statusIcon, {
                              className: `w-5 h-5 ${task.status === 'completed' ? 'text-[#22C55E]' : 'text-[#6B7A94]'}`
                            })}
                          </button>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-[#6B7A94]' : 'text-[#E8EEF9]'}`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-[#6B7A94] mt-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-[#6B7A94]">
                              {assignee && <span>Assigned to {assignee.display_name}</span>}
                              {task.due_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(task.due_date), 'MMM d')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CCCard>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            <CCCard className="p-4">
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Deal Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6B7A94]">Status:</span>
                  <CCBadge variant="primary">{dealRoom.status}</CCBadge>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A94]">Scene Type:</span>
                  <span className="text-[#E8EEF9] capitalize">{dealRoom.scene_type || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A94]">Compensation:</span>
                  <span className="text-[#E8EEF9] capitalize">{dealRoom.compensation_type?.replace('_', ' ') || 'N/A'}</span>
                </div>
                {dealRoom.schedule?.confirmed_date && (
                  <div className="flex justify-between">
                    <span className="text-[#6B7A94]">Date:</span>
                    <span className="text-[#E8EEF9]">{new Date(dealRoom.schedule.confirmed_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </CCCard>
          </div>
        )}
      </div>
    </div>
  );
}