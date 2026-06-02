'use client';

import { useChat } from '@ai-sdk/react';
import { useState, type FormEvent } from 'react';

export default function ChatPage() {
  const [agentId, setAgentId] = useState('assistant');
  const [inputValue, setInputValue] = useState('');

  // AI SDK v6 useChat API:
  // - handleSubmit/isLoading removed
  // - use sendMessage({ text }) to submit
  // - use status === 'streaming' | 'submitted' for loading state
  const { messages, sendMessage, status } = useChat({
    api: '/api/chat',
    body: { agentId },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue.trim() });
    setInputValue('');
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-white">Chat</h1>
        <input
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="agent ID"
          className="text-xs px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-300 w-36 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-16">
            <p className="text-2xl mb-2">◎</p>
            <p>Start a conversation with your agent.</p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xl px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-orange-500 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
              }`}
            >
              {m.parts.map((part, i) =>
                part.type === 'text' ? <span key={i}>{part.text}</span> : null
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm text-gray-400 text-sm">
              <span className="animate-pulse">●●●</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask your agent anything..."
          disabled={isLoading}
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="px-4 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
