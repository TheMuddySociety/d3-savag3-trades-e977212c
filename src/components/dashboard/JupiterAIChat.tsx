import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Sparkles, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@solana/wallet-adapter-react";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTED_PROMPTS = [
  "How do I launch a token on Jupiter Studio?",
  "Best bonding curve for a meme token?",
  "How do I use the Ultra Swap API?",
  "Analyze token safety with Shield API",
  "How to claim LP fees from my token?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jupiter-ai`;

export function JupiterAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;

  // Load persisted messages on mount / wallet change
  useEffect(() => {
    if (!walletAddress) {
      setMessages([]);
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    supabase
      .from("chat_messages")
      .select("role, content")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load chat history:", error);
        } else if (data) {
          setMessages(data.map((d) => ({ role: d.role as "user" | "assistant", content: d.content })));
        }
        setLoadingHistory(false);
      });
  }, [walletAddress]);

  // Persist a single message
  const persistMessage = useCallback(
    async (role: string, content: string) => {
      if (!walletAddress) return;
      const { error } = await supabase.from("chat_messages").insert({
        wallet_address: walletAddress,
        role,
        content,
      });
      if (error) console.error("Failed to persist message:", error);
    },
    [walletAddress]
  );

  // Clear chat history
  const clearHistory = async () => {
    if (!walletAddress) return;
    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("wallet_address", walletAddress);
    if (error) {
      toast.error("Failed to clear history");
    } else {
      setMessages([]);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: content.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    // Persist user message
    await persistMessage("user", userMsg.content);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        if (resp.status === 429) toast.error("Rate limit exceeded. Please wait a moment.");
        else if (resp.status === 402) toast.error("AI credits exhausted. Add credits in workspace settings.");
        else toast.error(err.error || "AI service error");
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantSoFar += delta;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Persist completed assistant message
      if (assistantSoFar) {
        await persistMessage("assistant", assistantSoFar);
      }
    } catch (e) {
      console.error("Chat error:", e);
      toast.error("Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-5 w-5 text-accent" />
            D3MON DAN
            <Badge variant="outline" className="text-xs border-accent/50 text-accent">
              AGENT
            </Badge>
          </CardTitle>
          {messages.length > 0 && walletAddress && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={clearHistory}
              title="Clear chat history"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <ScrollArea className="h-[320px] pr-2" ref={scrollRef}>
          <div className="space-y-3">
            {loadingHistory ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <Sparkles className="h-8 w-8 text-primary/50 mx-auto" />
                <p className="text-xs text-muted-foreground">
                  {walletAddress
                    ? "Ask anything about Jupiter, Solana DeFi, or trading strategies."
                    : "Connect your wallet to save chat history across sessions."}
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-[10px] px-2 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 border border-border text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-xs prose-invert max-w-none [&_p]:my-1 [&_pre]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_code]:text-[10px] [&_pre]:text-[10px]">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-muted/50 border border-border rounded-lg px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Ask D3MON Dan about a trade, strategy, or token..."
            className="h-8 text-xs bg-muted/50 border-border/50"
            disabled={isLoading}
          />
          <Button
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
