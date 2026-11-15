import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  MessageCircle, 
  Search, 
  Send, 
  Paperclip, 
  MoreVertical, 
  ChevronLeft,
  Trash2,
  Archive,
  Ban,
  Flag
} from 'lucide-react';
import ReportModal from '@/components/moderation/ReportModal';
import PullToRefresh from '@/components/ui-custom/PullToRefresh';
import { useProtectedMutation, revalidateBanStatus } from '@/hooks/useProtectedMutation';
import CCButton from '@/components/ui-custom/CCButton';
import CCInput from '@/components/ui-custom/CCInput';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import CommFilterWarning from '@/components/messaging/CommFilterWarning';
import { detectCommViolation, getEscalationLevel } from '@/lib/commFilter';
import { useFeatureFlag } from '@/lib/featureFlags';

export default function Messages() {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'conversation'|'block', id, extra }

  const [longPressMessage, setLongPressMessage] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetUserId, setReportTargetUserId] = useState(null);
  // Comm filter state
  const [commViolation, setCommViolation] = useState(null); // { type } | null
  const [commViolationCount, setCommViolationCount] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimer = useRef(null);
  const queryClient = useQueryClient();

  // Reset comm filter warning when conversation changes
  useEffect(() => {
    setCommViolation(null);
    setCommViolationCount(0);
  }, [selectedConversation?.id]);

  // Real-time message subscription
  useEffect(() => {
    if (!selectedConversation) return;
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.data?.conversation_id !== selectedConversation.id) return;
      queryClient.invalidateQueries(['messages', selectedConversation.id]);
    });
    return unsubscribe;
  }, [selectedConversation?.id]);

  const commFilterEnabled = useFeatureFlag('comm_filter');
  const verificationEnabled = useFeatureFlag('verification');
  const { protectedMutate } = useProtectedMutation();

  // Check auth and access
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Check verification status
  const { data: verifications = [] } = useQuery({
    queryKey: ['myVerification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  
  const isVerified = verifications.some(v => v.status === 'approved');

  // Real-time conversation list subscription
  useEffect(() => {
    if (!user) return;
    const unsubscribe = base44.entities.Conversation.subscribe(() => {
      queryClient.invalidateQueries(['conversations', user.email]);
    });
    return unsubscribe;
  }, [user?.email]);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.email],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ user_id: user?.email });
      return profiles[0];
    },
    enabled: !!user?.email,
  });

  const isAdmin = user?.role === 'admin' || user?.role_type === 'admin';

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', user?.email],
    queryFn: async () => {
      const allConvs = await base44.entities.Conversation.list('-last_message_at');
      return allConvs.filter(c => c.participant_ids?.includes(user?.email));
    },
    enabled: !!user,
  });

  // Check URL params for conversation ID
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversation');
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        setSelectedConversation(conv);
      }
    }
  }, [conversations]);

  // Fetch profiles for conversations
  const { data: participantProfiles = [] } = useQuery({
    queryKey: ['participantProfiles', conversations],
    queryFn: async () => {
      const allParticipants = [...new Set(conversations.flatMap(c => c.participant_ids || []))];
      const profiles = await base44.entities.UserProfile.list();
      return profiles.filter(p => allParticipants.includes(p.user_id));
    },
    enabled: conversations.length > 0,
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConversation?.id],
    queryFn: () => base44.entities.Message.filter({ conversation_id: selectedConversation?.id }, 'created_date'),
    enabled: !!selectedConversation,
  });

  // Mark messages as read when conversation is opened
  useEffect(() => {
    if (!selectedConversation || !user?.email || !messages.length) return;
    
    const markAsRead = async () => {
      const unreadMessages = messages.filter(m => 
        m.sender_id !== user.email && 
        (!m.read_by || !m.read_by.includes(user.email))
      );
      
      for (const msg of unreadMessages) {
        const updatedReadBy = msg.read_by ? [...msg.read_by, user.email] : [user.email];
        await base44.entities.Message.update(msg.id, {
          read_by: updatedReadBy
        });
      }
      
      if (unreadMessages.length > 0) {
        queryClient.invalidateQueries(['messages', selectedConversation.id]);
        queryClient.invalidateQueries(['allMessages']);
        queryClient.invalidateQueries(['conversations']);
      }
    };
    
    markAsRead();
  }, [selectedConversation?.id, messages.length]);

  const convQueryKey = ['conversations', user?.email];

  // Send message mutation — routes through protected backend (ban-enforced)
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      // Re-validate ban status before sending (closes stale-session bypass)
      const banStatus = await revalidateBanStatus(user?.email);
      if (!banStatus.allowed) {
        throw new Error('BLOCKED:' + banStatus.reason);
      }

      const result = await base44.functions.invoke('protectedActions', {
        conversation_id: messageData.conversation_id,
        body: messageData.body,
        attachments: messageData.attachments || []
      }, { queryParams: { action: 'send_message' } });

      if (result?.data?.blocked) {
        throw new Error('BLOCKED:' + (result.data.code || 'blocked'));
      }

      // Also update conversation participant tracking and send notifications client-side
      const currentRepliers = selectedConversation.participants_who_replied || [];
      const newRepliers = currentRepliers.includes(user.email)
        ? currentRepliers
        : [...currentRepliers, user.email];

      await base44.entities.Conversation.update(selectedConversation.id, {
        participants_who_replied: newRepliers
      });

      // Send notification to recipient(s) — non-critical, don't throw on failure
      const recipients = selectedConversation.participant_ids.filter(id => id !== user.email);
      for (const recipientId of recipients) {
        try {
          const prefs = await base44.entities.NotificationPreference.filter({
            user_id: recipientId, notification_type: 'messages'
          });
          const shouldNotify = !prefs.length || prefs[0].enabled !== false;
          if (shouldNotify) {
            await base44.entities.Notification.create({
              user_id: recipientId,
              type: 'messages',
              actor_user_id: user.email,
              title: 'New Message',
              body: `${profile?.display_name || 'Someone'} sent you a message`,
              related_entity_type: 'Conversation',
              related_entity_id: selectedConversation.id,
              action_url: `Messages?conversation=${selectedConversation.id}`
            });
          }
        } catch (e) { console.error('Notification error:', e); }
      }

      return result?.data?.data;
    },
    onMutate: async (messageData) => {
      await queryClient.cancelQueries({ queryKey: ['messages', selectedConversation?.id] });
      const previous = queryClient.getQueryData(['messages', selectedConversation?.id]);
      const optimistic = {
        id: `tmp_${Date.now()}`,
        conversation_id: messageData.conversation_id,
        sender_id: user?.email,
        body: messageData.body,
        attachments: messageData.attachments || [],
        created_date: new Date().toISOString(),
        read_by: [user?.email],
      };
      queryClient.setQueryData(['messages', selectedConversation?.id], (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['messages', selectedConversation?.id], ctx.previous);
      if (error.message?.startsWith('BLOCKED:')) {
        toast.error('Your account is blocked. You cannot send messages.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation?.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setNewMessage('');
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId) => {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      const wasRead = message.read_by?.some(id => id !== user.email);
      
      if (!wasRead) {
        // Unsend - delete completely and notify
        await base44.entities.Message.delete(messageId);
        
        // Send unsend notification
        const recipients = selectedConversation.participant_ids.filter(id => id !== user.email);
        for (const recipientId of recipients) {
          await base44.entities.Message.create({
            conversation_id: selectedConversation.id,
            sender_id: user.email,
            body: `${profile?.display_name || 'User'} unsent a message`,
            system_message: true,
            read_by: []
          });
        }
      } else {
        // Just delete for current user
        await base44.entities.Message.delete(messageId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', selectedConversation?.id]);
      setLongPressMessage(null);
      toast.success('Message deleted');
    },
  });

  // Archive conversation
  const archiveConversationMutation = useMutation({
    mutationFn: async (conversationId) => {
      await base44.entities.Conversation.update(conversationId, { status: 'archived' });
    },
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: convQueryKey });
      const previous = queryClient.getQueryData(convQueryKey);
      queryClient.setQueryData(convQueryKey, (old = []) => old.filter(c => c.id !== conversationId));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(convQueryKey, ctx.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: convQueryKey });
      setSelectedConversation(null);
      setShowConversationMenu(false);
      toast.success('Conversation archived');
    },
  });

  // Delete conversation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId) => {
      // Delete all messages first
      const convMessages = await base44.entities.Message.filter({ conversation_id: conversationId });
      await Promise.all(convMessages.map(m => base44.entities.Message.delete(m.id)));
      await base44.entities.Conversation.delete(conversationId);
    },
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: convQueryKey });
      const previous = queryClient.getQueryData(convQueryKey);
      queryClient.setQueryData(convQueryKey, (old = []) => old.filter(c => c.id !== conversationId));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(convQueryKey, ctx.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: convQueryKey });
      setSelectedConversation(null);
      setShowConversationMenu(false);
      toast.success('Conversation deleted');
    },
  });

  // Block user — routes through protected backend (ban-enforced)
  const blockUserMutation = useMutation({
    mutationFn: async (targetUserId) => {
      const banStatus = await revalidateBanStatus(user?.email);
      if (!banStatus.allowed) throw new Error('BLOCKED:' + banStatus.reason);

      const result = await base44.functions.invoke('protectedActions', {
        blocked_id: targetUserId
      }, { queryParams: { action: 'block_user' } });

      if (result?.data?.blocked) throw new Error('BLOCKED:' + (result.data.code || 'blocked'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['conversations']);
      setSelectedConversation(null);
      setShowConversationMenu(false);
      toast.success('User blocked');
    },
    onError: (error) => {
      if (error.message?.startsWith('BLOCKED:')) toast.error('Your account is blocked.');
    }
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;

    // Client-side comm filter pre-check
    if (commFilterEnabled) {
      const violation = detectCommViolation(newMessage.trim());
      if (violation) {
        const newCount = commViolationCount + 1;
        setCommViolationCount(newCount);
        setCommViolation(violation);
        return; // Block send — server will also enforce
      }
    }

    // Clear any prior warning on successful send attempt
    setCommViolation(null);

    sendMessageMutation.mutate({
      conversation_id: selectedConversation.id,
      sender_id: user.email,
      body: newMessage.trim(),
      attachments: [],
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Only images and videos are allowed');
      return;
    }

    setUploadingFile(true);
    try {
      const { data } = await base44.integrations.Core.UploadFile({ file });
      
      sendMessageMutation.mutate({
        conversation_id: selectedConversation.id,
        sender_id: user.email,
        body: isImage ? '📷 Image' : '🎥 Video',
        attachments: [{
          type: isImage ? 'image' : 'video',
          url: data.file_url,
          name: file.name,
          size: file.size
        }],
      });
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleLongPressStart = (messageId) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressMessage(messageId);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const getOtherParticipant = (conv) => {
    const otherId = conv.participant_ids?.find(id => id !== user?.email);
    return participantProfiles.find(p => p.user_id === otherId);
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const other = getOtherParticipant(conv);
    return other?.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (userLoading) {
    return <CCLoadingScreen message="Loading..." />;
  }

  return (
    <FeatureRouteGuard flag="messaging">
      <div className="min-h-screen pb-20 md:pb-0" style={{ backgroundColor: 'var(--cc-bg)' }}>
      <div className="max-w-6xl mx-auto h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex">
        {/* Conversation List */}
        <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`} style={{ borderColor: 'var(--cc-border)' }}>
          {/* Header */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--cc-border)' }}>
            <h1 className="text-xl font-semibold mb-3" style={{ color: 'var(--cc-text-primary)' }}>Messages</h1>
            <CCInput
              placeholder="Search conversations..."
              icon={Search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Conversation List */}
          <PullToRefresh
            className="flex-1"
            scrollable={true}
            onRefresh={() => queryClient.invalidateQueries(['conversations', user?.email])}
          >
            {conversationsLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex gap-3">
                     <div className="w-12 h-12 rounded-full" style={{ backgroundColor: 'var(--cc-border)' }} />
                     <div className="flex-1">
                       <div className="h-4 w-24 rounded mb-2" style={{ backgroundColor: 'var(--cc-border)' }} />
                       <div className="h-3 w-32 rounded" style={{ backgroundColor: 'var(--cc-border)' }} />
                     </div>
                   </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <CCEmpty
                icon={MessageCircle}
                title="No conversations"
                description="Start connecting with verified members to begin messaging."
              />
            ) : (
              <div>
                {filteredConversations.map((conv) => {
                  const other = getOtherParticipant(conv);
                  const isSelected = selectedConversation?.id === conv.id;
                  const unreadCount = conv.unread_counts?.[user.email] || 0;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className="w-full p-4 flex gap-3 text-left transition-colors"
                      style={{ backgroundColor: isSelected ? 'var(--cc-surface-hover)' : 'transparent' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <CCAvatar
                        src={other?.avatar_url}
                        alt={other?.display_name}
                        size="md"
                        online={other?.last_active_at && new Date(other.last_active_at) > new Date(Date.now() - 15 * 60 * 1000)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate" style={{ color: 'var(--cc-text-primary)' }}>
                            {other?.display_name || 'Unknown'}
                          </p>
                          {conv.last_message_at && (
                            <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
                              {new Date(conv.last_message_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm truncate" style={{ color: 'var(--cc-text-muted)' }}>
                            {conv.last_message_preview || 'No messages yet'}
                          </p>
                          {unreadCount > 0 && (
                            <CCBadge variant="accent" size="sm">{unreadCount}</CCBadge>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <CCBadge variant="outline" size="sm">
                            {conv.type}
                          </CCBadge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete({ type: 'conversation', id: conv.id });
                            }}
                            className="text-[#6B7A94] hover:text-[#EF4444] transition-colors"
                            title="Delete conversation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </PullToRefresh>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${
          selectedConversation ? 'flex' : 'hidden md:flex'
        }`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--cc-border)' }}>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-2 transition-colors"
                  style={{ color: 'var(--cc-text-secondary)' }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <CCAvatar
                  src={getOtherParticipant(selectedConversation)?.avatar_url}
                  size="sm"
                />
                <div className="flex-1">
                  <p className="font-medium" style={{ color: 'var(--cc-text-primary)' }}>
                    {getOtherParticipant(selectedConversation)?.display_name || 'Unknown'}
                  </p>
                  <p className="text-xs capitalize" style={{ color: 'var(--cc-text-muted)' }}>{selectedConversation.type} chat</p>
                </div>
                <div className="relative">
                  <CCButton 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowConversationMenu(!showConversationMenu)}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </CCButton>
                  {showConversationMenu && (
                    <div className="absolute right-0 top-full mt-2 w-52 rounded-lg shadow-xl z-50 border" style={{ backgroundColor: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
                      <button
                        onClick={() => {
                          archiveConversationMutation.mutate(selectedConversation.id);
                        }}
                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-t-lg"
                        style={{ color: 'var(--cc-text-primary)' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Archive className="w-4 h-4" />
                        Archive conversation
                      </button>
                      <button
                        onClick={() => {
                          const otherUserId = selectedConversation.participant_ids.find(id => id !== user.email);
                          setConfirmDelete({ type: 'block', id: otherUserId });
                        }}
                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors text-[#F59E0B]"
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Ban className="w-4 h-4" />
                        Block user
                      </button>
                      <button
                        onClick={() => {
                          const otherUserId = selectedConversation.participant_ids.find(id => id !== user.email);
                          setReportTargetUserId(otherUserId);
                          setShowReportModal(true);
                          setShowConversationMenu(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors text-[#F59E0B]"
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Flag className="w-4 h-4" />
                        Report user
                      </button>
                      <button
                        onClick={() => {
                          setConfirmDelete({ type: 'conversation', id: selectedConversation.id });
                        }}
                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-b-lg text-[#EF4444]"
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete conversation
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                <div className="text-center" style={{ color: 'var(--cc-text-muted)' }}>Loading messages...</div>
                ) : messages.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--cc-text-muted)' }}>
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === user.email;
                    const isSystemMessage = msg.system_message;
                    
                    if (isSystemMessage) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <p className="text-xs italic" style={{ color: 'var(--cc-text-muted)' }}>{msg.body}</p>
                        </div>
                      );
                    }

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-2 group ${isMine ? 'justify-end' : 'justify-start'}`}
                        onTouchStart={() => handleLongPressStart(msg.id)}
                        onTouchEnd={handleLongPressEnd}
                        onTouchCancel={handleLongPressEnd}
                      >
                        <div className={`max-w-[75%] ${isMine ? 'order-1' : 'order-2'}`}>
                          <div
                          className={`px-4 py-2 rounded-2xl ${isMine ? 'rounded-br-md' : 'rounded-bl-md'}`}
                          style={{
                            backgroundColor: isMine ? 'var(--cc-blue)' : 'var(--cc-surface)',
                            color: isMine ? '#fff' : 'var(--cc-text-primary)',
                            border: isMine ? 'none' : '1px solid var(--cc-border)',
                          }}
                          >
                            {msg.attachments?.[0] ? (
                              <div>
                                {msg.attachments[0].type === 'image' ? (
                                  <img 
                                    src={msg.attachments[0].url} 
                                    alt="Shared" 
                                    className="max-w-xs rounded-lg mb-2"
                                  />
                                ) : (
                                  <video 
                                    src={msg.attachments[0].url} 
                                    controls 
                                    className="max-w-xs rounded-lg mb-2"
                                  />
                                )}
                                <p className="text-sm">{msg.body}</p>
                              </div>
                            ) : (
                              <p className="text-sm">{msg.body}</p>
                            )}
                          </div>
                          <p className={`text-xs mt-1 ${isMine ? 'text-right' : ''}`} style={{ color: 'var(--cc-text-muted)' }}>
                            {new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteMessageMutation.mutate(msg.id)}
                          className={`hidden md:block opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded self-start hover:bg-[rgba(0,0,0,0.1)] ${
                            isMine ? 'order-2' : 'order-1'
                          }`}
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4 text-[#EF4444]" />
                        </button>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t" style={{ borderColor: 'var(--cc-border)' }}>
                <CommFilterWarning
                  violation={commViolation}
                  level={getEscalationLevel(commViolationCount - 1)}
                  onDismiss={() => setCommViolation(null)}
                />
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <CCButton 
                    variant="ghost" 
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    loading={uploadingFile}
                  >
                    <Paperclip className="w-5 h-5" />
                  </CCButton>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      if (commViolation) setCommViolation(null);
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg px-4 py-2 focus:outline-none focus:ring-2"
                    style={{ backgroundColor: 'var(--cc-bg)', border: '1px solid var(--cc-border)', color: 'var(--cc-text-primary)' }}
                  />
                  <CCButton
                    variant="primary"
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    loading={sendMessageMutation.isPending}
                  >
                    <Send className="w-5 h-5" />
                  </CCButton>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <CCEmpty
                icon={MessageCircle}
                title="Select a conversation"
                description="Choose a conversation from the list to start messaging."
              />
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog (replaces window.confirm) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl border" style={{ backgroundColor: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
            <p className="font-semibold mb-2" style={{ color: 'var(--cc-text-primary)' }}>
              {confirmDelete.type === 'block' ? 'Block this user?' : 'Delete conversation?'}
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--cc-text-muted)' }}>
              {confirmDelete.type === 'block'
                ? 'They will not be able to contact you.'
                : 'This action cannot be undone.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--cc-border)', color: 'var(--cc-text-primary)' }}>Cancel</button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'block') blockUserMutation.mutate(confirmDelete.id);
                  else deleteConversationMutation.mutate(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 rounded-lg text-sm bg-[#EF4444] text-white"
              >
                {confirmDelete.type === 'block' ? 'Block' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Long Press Menu */}
      {longPressMessage && (
        <div 
          className="fixed inset-0 z-50 flex items-end md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setLongPressMessage(null)}
        >
          <div className="w-full rounded-t-2xl p-4" style={{ backgroundColor: 'var(--cc-surface)' }}>
            <button
              onClick={() => {
                deleteMessageMutation.mutate(longPressMessage);
              }}
              className="w-full py-4 font-medium text-center text-[#EF4444]"
            >
              Delete Message
            </button>
            <button
              onClick={() => setLongPressMessage(null)}
              className="w-full py-4 font-medium text-center"
              style={{ color: 'var(--cc-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportTargetUserId(null);
        }}
        targetUserId={reportTargetUserId}
        targetContentType="message"
        targetContentId={selectedConversation?.id}
      />
      </div>
    </FeatureRouteGuard>
  );
}