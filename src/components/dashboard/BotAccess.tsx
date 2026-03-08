import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Clock, Crosshair, BarChart3, Brain } from "lucide-react";
import { DCABot } from "./bot-tools/DCABot";
import { BuySniper } from "./bot-tools/BuySniper";
import { VolumeBot } from "./bot-tools/VolumeBot";
import { AutoStrategies } from "./bot-tools/AutoStrategies";

export const BotAccess = () => {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm">Bot Trading Tools</CardTitle>
          <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium ml-auto">
            LIVE
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs defaultValue="sniper" className="w-full">
          <TabsList className="w-full grid grid-cols-4 bg-muted/30 h-8 mb-3">
            <TabsTrigger value="sniper" className="text-xs gap-1 data-[state=active]:bg-primary/20">
              <Crosshair className="h-3 w-3" />
              <span className="hidden sm:inline">Sniper</span>
            </TabsTrigger>
            <TabsTrigger value="dca" className="text-xs gap-1 data-[state=active]:bg-accent/20">
              <Clock className="h-3 w-3" />
              <span className="hidden sm:inline">DCA</span>
            </TabsTrigger>
            <TabsTrigger value="volume" className="text-xs gap-1 data-[state=active]:bg-accent/20">
              <BarChart3 className="h-3 w-3" />
              <span className="hidden sm:inline">Volume</span>
            </TabsTrigger>
            <TabsTrigger value="auto" className="text-xs gap-1 data-[state=active]:bg-primary/20">
              <Brain className="h-3 w-3" />
              <span className="hidden sm:inline">Auto</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sniper" className="mt-0">
            <BuySniper />
          </TabsContent>
          <TabsContent value="dca" className="mt-0">
            <DCABot />
          </TabsContent>
          <TabsContent value="volume" className="mt-0">
            <VolumeBot />
          </TabsContent>
          <TabsContent value="auto" className="mt-0">
            <AutoStrategies />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
