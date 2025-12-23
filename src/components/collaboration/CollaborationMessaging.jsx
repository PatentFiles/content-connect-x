import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Paperclip, AlertCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function CollaborationMessaging({ collaborationId, currentUser, userRole }) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['collaborationMessages', collaborationId],
    queryFn: () => base44.entities.CollaborationMessage.filter({ 
      collaboration_id: collaborationId 
    }),
    enabled: !!collaborationId,
    refetchInterval: 3000,
  });

  const { data: participantRoles = [] } = useQuery({
    queryKey: ['participantRoles', collaborationId],
    queryFn: () => base44.entities.CollaborationParticipantRole.filter({
      collaboration_id: collaborationId
    }),
    enabled: !!collaborationId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['messageProfiles', messages],
    queryFn: async () => {
      const userIds = [...new Set(messages.map(m => m.sender_user_id))];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => userIds.includes(p.user_id));
    },
    enabled: messages.length > 0,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data) => {
      // Log activity
      await base44.entities.CollaborationActivity.create({
        collaboration_id: collaborationId,
        user_id: currentUser.email,
        activity_type: 'message_sent',
        description: `${currentUser.full_name} sent a message`,
        metadata: { message_preview: data.message_body.substring(0, 50) }
      });
      
      return base44.entities.CollaborationMessage.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborationMessages'] });
      queryClient.invalidateQueries({ queryKey: ['collaborationActivity'] });
      setMessage('');
      setAttachments([]);
    },
    onError: () => {
      toast.error('Failed to send message');
    }
  });

  const handleSend = () => {
    if (!message.trim() && attachments.length === 0) return;

    sendMessageMutation.mutate({
      collaboration_id: collaborationId,
      sender_user_id: currentUser.email,
      sender_role: userRole,
      message_body: message,
      attachments: attachments,
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canSendMessages = userRole === 'Admin' || userRole === 'Member';

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#263248]">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9]">Collaboration Chat</h3>
          <p className="text-xs text-[#6B7A94]">Immutable legal record • All messages logged</p>
        </div>
        <CCBadge variant="warning" icon={AlertCircle}>
          Audit Trail
        </CCBadge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const profile = profiles.find(p => p.user_id === msg.sender_user_id);
          const isCurrentUser = msg.sender_user_id === currentUser.email;

          return (
            <div key={msg.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-[#9AA6BC]">
                    {profile?.display_name || 'User'}
                  </span>
                  <CCBadge size="sm" variant="outline">{msg.sender_role}</CCBadge>
                  {msg.flagged && (
                    <CCBadge size="sm" variant="danger">Flagged</CCBadge>
                  )}
                </div>
                <div className={`rounded-lg px-4 py-2 ${
                  isCurrentUser 
                    ? 'bg-[#4F8CFF] text-white' 
                    : 'bg-[#151D2B] text-[#E8EEF9]'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.message_body}</p>
                  {msg.attachments?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {msg.attachments.map((att, i) => (
                        <a 
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs underline"
                        >
                          <Paperclip className="w-3 h-3" />
                          {att.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs text-[#6B7A94] mt-1">
                  {format(new Date(msg.created_date), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {canSendMessages ? (
        <div className="p-4 border-t border-[#263248]">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              className="flex-1 bg-[#151D2B] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
            <CCButton
              variant="primary"
              icon={Send}
              onClick={handleSend}
              loading={sendMessageMutation.isPending}
              disabled={!message.trim() && attachments.length === 0}
            />
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-[#263248] bg-[#151D2B]">
          <p className="text-sm text-[#6B7A94] text-center">
            Viewers have read-only access to messages
          </p>
        </div>
      )}
    </div>
  );
}