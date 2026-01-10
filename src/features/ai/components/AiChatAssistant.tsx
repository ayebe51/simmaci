import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Loader2, Bot, User } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any[];
  sql?: string;
}

export default function AiChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // Load suggested questions on mount
  useState(() => {
    api.ai.getSuggestedQuestions().then((data) => {
      setSuggestedQuestions(data.questions || []);
    });
  });

  const handleSend = async (question?: string) => {
    const userMessage = question || input.trim();
    if (!userMessage) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await api.ai.query({ question: userMessage });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          data: response.data,
          sql: response.sql,
        },
      ]);
    } catch (error: any) {
      console.error('[AI Chat Error]', error);
      toast.error('Gagal memproses pertanyaan. Coba lagi.');
      
      // Remove user message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Card className="h-[calc(100vh-12rem)] flex flex-col">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">AI Assistant</CardTitle>
              <CardDescription>
                Tanyakan apa saja tentang data guru, SK, atau madrasah
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex p-4 bg-primary/5 rounded-full mb-4">
                <Bot className="w-12 h-12 text-primary opacity-50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Selamat datang di AI Assistant
              </h3>
              <p className="text-muted-foreground mb-6">
                Mulai percakapan dengan mengetik pertanyaan atau pilih contoh di bawah
              </p>

              {suggestedQuestions.length > 0 && (
                <div className="space-y-2 max-w-md mx-auto">
                  <p className="text-sm font-medium text-left">Contoh pertanyaan:</p>
                  {suggestedQuestions.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="w-full justify-start text-left"
                      onClick={() => handleSend(q)}
                      disabled={isLoading}
                    >
                      <Sparkles className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{q}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground pl-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">AI sedang berpikir...</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t pt-4">
          <div className="flex gap-2 w-full">
            <Input
              placeholder="Tanyakan sesuatu... (contoh: Berapa guru yang belum sertifikasi?)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={() => handleSend()} 
              disabled={isLoading || !input.trim()}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className={`flex-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-lg p-3 ${
            isUser
              ? 'bg-primary text-primary-foreground ml-auto'
              : 'bg-muted'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>

          {message.data && message.data.length > 0 && (
            <div className="mt-3 pt-3 border-t border-current/10">
              <p className="text-xs opacity-70 mb-1">
                📊 Ditemukan {message.data.length} hasil
              </p>
            </div>
          )}

          {message.sql && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
                🔍 Lihat SQL Query
              </summary>
              <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-x-auto">
                {message.sql}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
