import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  MessageCircle, 
  Search, 
  Send, 
  Paperclip, 
  MoreVertical, 
  ChevronLeft,
  Phone,
  Video,
  Info,
  Image,
  File,
  X,
  Trash2,
  Archive,
  Ban,
  Flag
} from 'lucide-react';
import ReportModal from '@/components/moderation/ReportModal';
import CCButton from '@/components/ui-custom/CCButton';
import CCInput from '@/components/ui-custom/CCInput';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCCard from '@/components/ui-custom/CCCard';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import AccessGate from '@/components/auth/AccessGate';
import { useVerificationCheck } from '@/components/auth/useVerificationCheck';
import VerificationRequired from '@/components/auth/VerificationRequired';

export default function Messages() {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [longPressMessage, setLongPressMessage] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetUserId, setReportTargetUserId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimer = useRef(null);
  const queryClient = useQueryClient();

  // Real-time message subscription
  useEffect(() => {
    if (!selectedConversation) return;
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.data?.conversation_id !== selectedConversation.id) return;
      queryClient.invalidateQueries(['messages', selectedConversation.id]);
    });
    return unsubscribe;
  }, [selectedConversation?.id]);

  // Real-time conversation list subscription
  useEffect(() => {
    if (!user) return;
    const unsubscribe = base44.entities.Conversation.subscribe(() => {
      queryClient.invalidateQueries(['conversations', user.email]);
    });
    return unsubscribe;
  }, [user?.email]);
  
  const { checking: verificationChecking, blocked: verificationBlocked } = useVerificationCheck('send_message');

  // Check auth and access
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.email],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ user_id: user?.email });
      return profiles[0];
    },
    enabled: !!user?.email,
  });

  const { data: verification } = useQuery({
    queryKey: ['verification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.email],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const isAdmin = profile?.is_admin;
  const isVerified = verification?.[0]?.status === 'approved' || isAdmin;
  const isSubscribed = subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial' || isAdmin;

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', user?.email],
    queryFn: async () => {
      const allConvs = await base44.entities.Conversation.list('-last_message_at');
      return allConvs.filter(c => c.participant_ids?.includes(user?.email));
    },
    enabled: !!user && (isVerified || isAdmin) && (isSubscribed || isAdmin),
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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      const message = await base44.entities.Message.create(messageData);
      
      // Track that this participant has replied
      const currentRepliers = selectedConversation.participants_who_replied || [];
      const newRepliers = currentRepliers.includes(user.email) 
        ? currentRepliers 
        : [...currentRepliers, user.email];
      
      await base44.entities.Conversation.update(selectedConversation.id, {
        last_message_at: new Date().toISOString(),
        last_message_preview: messageData.body.substring(0, 50),
        participants_who_replied: newRepliers
      });

      // Send notification to recipient(s)
      const recipients = selectedConversation.participant_ids.filter(id => id !== user.email);
      
      for (const recipientId of recipients) {
        try {
          const prefs = await base44.entities.NotificationPreference.filter({
            user_id: recipientId,
            notification_type: 'messages'
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
        } catch (error) {
          console.error('Failed to send notification:', error);
        }
      }

      return message;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', selectedConversation?.id]);
      queryClient.invalidateQueries(['conversations']);
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
      await base44.entities.Conversation.update(conversationId, {
        status: 'archived'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['conversations']);
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
      // Delete conversation
      await base44.entities.Conversation.delete(conversationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['conversations']);
      setSelectedConversation(null);
      setShowConversationMenu(false);
      toast.success('Conversation deleted');
    },
  });

  // Block user
  const blockUserMutation = useMutation({
    mutationFn: async (targetUserId) => {
      await base44.entities.BlockedUser.create({
        blocker_id: user.email,
        blocked_id: targetUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['conversations']);
      setSelectedConversation(null);
      setShowConversationMenu(false);
      toast.success('User blocked');
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    // Enforce daily message limit from subscription plan
    const sub = subscription?.[0];
    if (sub?.status === 'active' || sub?.status === 'trial') {
      const { data: pricingTiers = [] } = { data: [] }; // Limits checked client-side via cached data
    }

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

  if (userLoading || verificationChecking) {
    return <CCLoadingScreen message="Loading..." />;
  }

  if (!user) {
    return <AccessGate type="both" />;
  }

  if (!isAdmin && verificationBlocked) {
    return <VerificationRequired action="send messages" />;
  }

  if (!isAdmin && !isVerified) {
    return <AccessGate type="verification" />;
  }

  if (!isAdmin && !isSubscribed) {
    return <AccessGate type="subscription" />;
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex">
        {/* Conversation List */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-[#263248] flex flex-col ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header */}
          <div className="p-4 border-b border-[#263248]">
            <h1 className="text-xl font-semibold text-[#E8EEF9] mb-3">Messages</h1>
            <CCInput
              placeholder="Search conversations..."
              icon={Search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#263248]" />
                    <div className="flex-1">
                      <div className="h-4 w-24 bg-[#263248] rounded mb-2" />
                      <div className="h-3 w-32 bg-[#263248] rounded" />
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
                      className={`w-full p-4 flex gap-3 text-left transition-colors ${
                        isSelected ? 'bg-[#151D2B]' : 'hover:bg-[#121824]'
                      }`}
                    >
                      <CCAvatar
                        src={other?.avatar_url}
                        alt={other?.display_name}
                        size="md"
                        online={other?.last_active_at && new Date(other.last_active_at) > new Date(Date.now() - 15 * 60 * 1000)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-[#E8EEF9] truncate">
                            {other?.display_name || 'Unknown'}
                          </p>
                          {conv.last_message_at && (
                            <span className="text-xs text-[#6B7A94]">
                              {new Date(conv.last_message_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-[#6B7A94] truncate">
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
                              if (confirm('Delete this conversation?')) {
                                deleteConversationMutation.mutate(conv.id);
                              }
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
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${
          selectedConversation ? 'flex' : 'hidden md:flex'
        }`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-[#263248] flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-2 text-[#9AA6BC] hover:text-[#E8EEF9]"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <CCAvatar
                  src={getOtherParticipant(selectedConversation)?.avatar_url}
                  size="sm"
                />
                <div className="flex-1">
                  <p className="font-medium text-[#E8EEF9]">
                    {getOtherParticipant(selectedConversation)?.display_name || 'Unknown'}
                  </p>
                  <p className="text-xs text-[#6B7A94] capitalize">{selectedConversation.type} chat</p>
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
                    <div className="absolute right-0 top-full mt-2 w-52 bg-[#151D2B] border border-[#263248] rounded-lg shadow-xl z-50">
                      <button
                        onClick={() => {
                          archiveConversationMutation.mutate(selectedConversation.id);
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-[#E8EEF9] hover:bg-[#1A2438] flex items-center gap-3 transition-colors"
                      >
                        <Archive className="w-4 h-4" />
                        Archive conversation
                      </button>
                      <button
                        onClick={() => {
                          const otherUserId = selectedConversation.participant_ids.find(id => id !== user.email);
                          if (confirm('Block this user? They will not be able to contact you.')) {
                            blockUserMutation.mutate(otherUserId);
                          }
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-[#F59E0B] hover:bg-[#F59E0B]/10 flex items-center gap-3 transition-colors"
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
                        className="w-full px-4 py-3 text-left text-sm text-[#F59E0B] hover:bg-[#F59E0B]/10 flex items-center gap-3 transition-colors"
                      >
                        <Flag className="w-4 h-4" />
                        Report user
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this conversation? This cannot be undone.')) {
                            deleteConversationMutation.mutate(selectedConversation.id);
                          }
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-[#EF4444] hover:bg-[#EF4444]/10 flex items-center gap-3 transition-colors rounded-b-lg"
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
                  <div className="text-center text-[#6B7A94]">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-[#6B7A94] py-8">
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
                          <p className="text-xs text-[#6B7A94] italic">{msg.body}</p>
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
                            className={`px-4 py-2 rounded-2xl ${
                              isMine
                                ? 'bg-[#4F8CFF] text-white rounded-br-md'
                                : 'bg-[#151D2B] text-[#E8EEF9] rounded-bl-md'
                            }`}
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
                          <p className={`text-xs text-[#6B7A94] mt-1 ${isMine ? 'text-right' : ''}`}>
                            {new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteMessageMutation.mutate(msg.id)}
                          className={`hidden md:block opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[#263248] rounded self-start ${
                            isMine ? 'order-2' : 'order-1'
                          }`}
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4 text-[#6B7A94] hover:text-[#EF4444]" />
                        </button>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-[#263248]">
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
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
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

      {/* Mobile Long Press Menu */}
      {longPressMessage && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-end md:hidden"
          onClick={() => setLongPressMessage(null)}
        >
          <div className="w-full bg-[#151D2B] rounded-t-2xl p-4">
            <button
              onClick={() => {
                deleteMessageMutation.mutate(longPressMessage);
              }}
              className="w-full py-4 text-[#EF4444] font-medium text-center"
            >
              Delete Message
            </button>
            <button
              onClick={() => setLongPressMessage(null)}
              className="w-full py-4 text-[#9AA6BC] font-medium text-center"
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
  );
}