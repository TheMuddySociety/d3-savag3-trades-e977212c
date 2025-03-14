
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SwapSettingsProps {
  maxAccounts: number | undefined;
  setMaxAccounts: (value: number | undefined) => void;
  priorityLevel: 'low' | 'medium' | 'high' | 'veryHigh' | undefined;
  setPriorityLevel: (value: 'low' | 'medium' | 'high' | 'veryHigh' | undefined) => void;
}

export function SwapSettings({ 
  maxAccounts, 
  setMaxAccounts, 
  priorityLevel, 
  setPriorityLevel 
}: SwapSettingsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium">Advanced Settings</h4>
          <div className="space-y-2">
            <Label htmlFor="maxAccounts">Max Accounts (optional)</Label>
            <Input
              id="maxAccounts"
              type="number"
              value={maxAccounts || ''}
              onChange={(e) => setMaxAccounts(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Default: no limit"
              min={1}
              max={64}
            />
            <p className="text-xs text-muted-foreground">
              Limit the number of accounts in the transaction (1-64). 
              Useful when combining with other instructions.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priorityLevel">Priority Fee</Label>
            <Select
              value={priorityLevel || ''}
              onValueChange={(value) => setPriorityLevel(value as 'low' | 'medium' | 'high' | 'veryHigh' | undefined)}
            >
              <SelectTrigger id="priorityLevel">
                <SelectValue placeholder="Default (none)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Default (none)</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="veryHigh">Very High</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Higher priority fees help transactions land faster on-chain.
              "Very High" is recommended for times of network congestion.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
