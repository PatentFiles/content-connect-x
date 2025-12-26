import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, Send, Loader2, Bot, User, Copy, CheckCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard, { CCCardHeader, CCCardTitle, CCCardContent } from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const QUICK_ACTIONS = [
  { label: 'Review High-Risk Collaborations', prompt: 'Review all collaborations with high risk scores and provide a summary' },
  { label: 'Pending Verifications Status', prompt: 'Check all pending verifications and identify any that need urgent admin attention' },
  { label: 'Recent Contract Audit', prompt: 'Audit all contracts created in the last 7 days for compliance issues' },
  { label: 'Representation Conflicts', prompt: 'Find any representation conflicts between agents and studios, particularly exclusivity violations' },
  { label: 'Incomplete Profiles', prompt: 'Identify profiles missing critical verification or required fields' },
];

export default function ComplianceAgent() {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize conversation
  useEffect(() => {
    const initConversation = async () => {
      try {
        const conversation = await base44.agents.createConversation({
          agent_name: 'compliance_safety_agent',
          metadata: {
            name: 'Compliance Review Session',
            created_at: new Date().toISOString(),
          },
        });
        setConversationId(conversation.id);

        // Subscribe to updates
        const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
          setMessages(data.messages);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Failed to initialize compliance agent:', error);
        toast.error('Failed to initialize compliance agent');
      }
    };

    initConversation();
  }, []);

  const handleSend = async (messageText = input) => {
    if (!messageText.trim() || !conversationId || isLoading) return;

    setIsLoading(true);
    setInput('');

    try {
      // Get conversation
      const conversation = await base44.agents.getConversation(conversationId);

      // Send message
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: messageText,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt) => {
    setInput(prompt);
    handleSend(prompt);
  };

  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content);
    toast.success('Message copied to clipboard');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <CCCard padding="lg" className="bg-gradient-to-r from-[#4F8CFF]/10 to-[#FF2DAA]/10 border-[#4F8CFF]/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#4F8CFF]/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#4F8CFF]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#E8EEF9]">Compliance & Safety Review Agent</h3>
            <p className="text-sm text-[#9AA6BC] mt-1">
              Internal read-only assistant for compliance analysis. Reviews profiles, collaborations, and contracts for policy violations and safety risks.
            </p>
            <div className="flex gap-2 mt-3">
              <CCBadge variant="primary" size="sm">Read-Only</CCBadge>
              <CCBadge variant="accent" size="sm">Non-Binding</CCBadge>
              <CCBadge variant="success" size="sm">Evidence-Based</CCBadge>
            </div>
          </div>
        </div>
      </CCCard>

      {/* Quick Actions */}
      <CCCard padding="lg">
        <CCCardHeader>
          <CCCardTitle>Quick Actions</CCCardTitle>
        </CCCardHeader>
        <CCCardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action, index) => (
              <CCButton
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.prompt)}
                className="justify-start text-left"
                disabled={isLoading}
              >
                {action.label}
              </CCButton>
            ))}
          </div>
        </CCCardContent>
      </CCCard>

      {/* Chat Interface */}
      <CCCard padding="none" className="h-[600px] flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-[#4F8CFF] mx-auto mb-4 opacity-50" />
              <p className="text-[#9AA6BC]">Ask the compliance agent to review profiles, collaborations, or contracts</p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-[#4F8CFF]" />
                </div>
              )}
              
              <div
                className={`max-w-[85%] rounded-xl p-4 ${
                  message.role === 'user'
                    ? 'bg-[#4F8CFF] text-white'
                    : 'bg-[#151D2B] border border-[#263248]'
                }`}
              >
                {message.role === 'user' ? (
                  <p className="text-sm">{message.content}</p>
                ) : (
                  <div className="space-y-2">
                    <ReactMarkdown
                      className="text-sm prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                      components={{
                        p: ({ children }) => <p className="text-[#E8EEF9] my-2">{children}</p>,
                        strong: ({ children }) => <strong className="text-[#4F8CFF] font-semibold">{children}</strong>,
                        ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-[#E8EEF9]">{children}</li>,
                        code: ({ inline, children }) => inline ? (
                          <code className="px-1.5 py-0.5 rounded bg-[#0B0F14] text-[#4F8CFF] text-xs">{children}</code>
                        ) : (
                          <pre className="bg-[#0B0F14] p-3 rounded-lg overflow-x-auto my-2">
                            <code className="text-[#E8EEF9] text-xs">{children}</code>
                          </pre>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="w-full text-sm border-collapse">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="border-b border-[#263248]">{children}</thead>,
                        th: ({ children }) => <th className="text-left p-2 text-[#9AA6BC] font-medium">{children}</th>,
                        td: ({ children }) => <td className="p-2 text-[#E8EEF9]">{children}</td>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                    
                    {/* Tool calls */}
                    {message.tool_calls?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.tool_calls.map((tool, idx) => (
                          <div key={idx} className="text-xs text-[#6B7A94] bg-[#0B0F14] rounded px-2 py-1">
                            <span className="text-[#4F8CFF]">→</span> {tool.name}
                            {tool.status === 'completed' && (
                              <CheckCircle className="inline w-3 h-3 ml-1 text-[#22C55E]" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <CCButton
                      variant="ghost"
                      size="sm"
                      icon={Copy}
                      onClick={() => handleCopyMessage(message.content)}
                      className="mt-2"
                    >
                      Copy
                    </CCButton>
                  </div>
                )}
              </div>
              
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-[#263248] flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[#9AA6BC]" />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#4F8CFF]" />
              </div>
              <div className="bg-[#151D2B] border border-[#263248] rounded-xl p-4">
                <Loader2 className="w-4 h-4 animate-spin text-[#4F8CFF]" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#263248] p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask about profiles, collaborations, contracts, or compliance issues..."
              className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
              disabled={isLoading}
            />
            <CCButton
              variant="primary"
              icon={Send}
              onClick={() => handleSend()}
              loading={isLoading}
              disabled={!input.trim()}
            >
              Send
            </CCButton>
          </div>
        </div>
      </CCCard>
    </div>
  );
}