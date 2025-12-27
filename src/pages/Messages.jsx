import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
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
  X
} from 'lucide-react';
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
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  
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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      const message = await base44.entities.Message.create(messageData);
      await base44.entities.Conversation.update(selectedConversation.id, {
        last_message_at: new Date().toISOString(),
        last_message_preview: messageData.body.substring(0, 50),
      });

      // Send notification to recipient(s)
      const recipients = selectedConversation.participant_ids.filter(id => id !== user.email);
      const senderProfile = participantProfiles.find(p => p.user_id === user.email);
      
      for (const recipientId of recipients) {
        try {
          const { notifyNewMessage } = await import('../components/notifications/notificationHelpers');
          await notifyNewMessage(
            recipientId, 
            user.email, 
            senderProfile, 
            selectedConversation.type, 
            selectedConversation.id
          );
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    sendMessageMutation.mutate({
      conversation_id: selectedConversation.id,
      sender_id: user.email,
      body: newMessage.trim(),
      attachments: [],
    });
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
                        <CCBadge variant="outline" size="sm" className="mt-1">
                          {conv.type}
                        </CCBadge>
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
                <CCButton variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </CCButton>
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
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] ${isMine ? 'order-1' : 'order-2'}`}>
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              isMine
                                ? 'bg-[#4F8CFF] text-white rounded-br-md'
                                : 'bg-[#151D2B] text-[#E8EEF9] rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm">{msg.body}</p>
                          </div>
                          <p className={`text-xs text-[#6B7A94] mt-1 ${isMine ? 'text-right' : ''}`}>
                            {new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-[#263248]">
                <div className="flex gap-2">
                  <CCButton variant="ghost" size="icon">
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
    </div>
  );
}