
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Bell, BellOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const UPCOMING_LAUNCHES = [
  {
    id: 1,
    name: "DogeMoon",
    date: "2023-09-18T14:00:00Z",
    description: "The next big doge-themed token with innovative tokenomics",
    tags: ["Meme", "Doge", "Fair Launch"]
  },
  {
    id: 2,
    name: "SafeFrog",
    date: "2023-09-20T18:30:00Z",
    description: "Amphibian-themed token with auto-staking rewards",
    tags: ["Meme", "Rewards", "Staking"]
  },
  {
    id: 3,
    name: "MoonCat",
    date: "2023-09-23T10:00:00Z",
    description: "Feline-focused token with NFT integration",
    tags: ["Meme", "NFT", "DAO"]
  },
  {
    id: 4,
    name: "RocketDoge",
    date: "2023-09-25T16:00:00Z",
    description: "Multi-chain doge token with interoperability features",
    tags: ["Meme", "Multi-chain", "Airdrop"]
  }
];

export function LaunchCalendar() {
  const [reminders, setReminders] = useState<number[]>([]);
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleReminder = (id: number) => {
    setReminders(prev => {
      if (prev.includes(id)) {
        toast({
          title: "Reminder Removed",
          description: "You will no longer receive notifications for this launch"
        });
        return prev.filter(item => item !== id);
      } else {
        toast({
          title: "Reminder Set",
          description: "You will be notified before this token launches"
        });
        return [...prev, id];
      }
    });
  };

  const getTimeUntilLaunch = (dateString: string) => {
    const launchDate = new Date(dateString);
    const now = new Date();
    
    const diffMs = launchDate.getTime() - now.getTime();
    if (diffMs <= 0) return "Launched";
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    } else {
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${diffHours}h ${diffMinutes}m`;
    }
  };

  return (
    <Card className="memecoin-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Calendar className="h-5 w-5 text-solana" />
          Upcoming Launches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {UPCOMING_LAUNCHES.map((launch) => (
            <div 
              key={launch.id} 
              className="p-3 rounded-lg bg-background/40 border border-border hover:border-solana/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{launch.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(launch.date)}
                    <Clock className="h-3 w-3 ml-2" />
                    {formatTime(launch.date)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-solana/10 text-solana border-solana/20">
                    {getTimeUntilLaunch(launch.date)}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className={cn(
                      "rounded-full",
                      reminders.includes(launch.id) && "text-solana"
                    )}
                    onClick={() => toggleReminder(launch.id)}
                  >
                    {reminders.includes(launch.id) ? (
                      <Bell className="h-4 w-4" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {launch.description}
              </p>
              <div className="flex flex-wrap gap-1">
                {launch.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
