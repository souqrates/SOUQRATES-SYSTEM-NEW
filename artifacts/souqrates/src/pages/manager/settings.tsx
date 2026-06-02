import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

export default function SystemSettings() {
  const { data: settings, isLoading } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    skzPerTon: "0",
    skzPerUsdt: "0",
    level1Rate: "0",
    level2Rate: "0",
    level3Rate: "0",
    minDeposit: "0",
    maintenanceMode: false,
    welcomeMessage: ""
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        skzPerTon: settings.skzPerTon.toString(),
        skzPerUsdt: settings.skzPerUsdt.toString(),
        level1Rate: settings.level1Rate.toString(),
        level2Rate: settings.level2Rate.toString(),
        level3Rate: settings.level3Rate.toString(),
        minDeposit: settings.minDeposit.toString(),
        maintenanceMode: settings.maintenanceMode,
        welcomeMessage: settings.welcomeMessage || ""
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      data: {
        skzPerTon: Number(formData.skzPerTon),
        skzPerUsdt: Number(formData.skzPerUsdt),
        level1Rate: Number(formData.level1Rate),
        level2Rate: Number(formData.level2Rate),
        level3Rate: Number(formData.level3Rate),
        minDeposit: Number(formData.minDeposit),
        maintenanceMode: formData.maintenanceMode,
        welcomeMessage: formData.welcomeMessage
      }
    }, {
      onSuccess: () => {
        toast({ title: "Settings updated", description: "System settings have been saved successfully" });
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      }
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-orbitron text-lg">Exchange Rates</CardTitle>
            <CardDescription>Configure SKZ minting rates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-orbitron text-xs text-muted-foreground">SKZ per 1 TON</Label>
              <Input 
                type="number" 
                value={formData.skzPerTon} 
                onChange={e => setFormData({...formData, skzPerTon: e.target.value})}
                className="bg-background font-orbitron"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-orbitron text-xs text-muted-foreground">SKZ per 1 USDT</Label>
              <Input 
                type="number" 
                value={formData.skzPerUsdt} 
                onChange={e => setFormData({...formData, skzPerUsdt: e.target.value})}
                className="bg-background font-orbitron"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-orbitron text-xs text-muted-foreground">Minimum Deposit</Label>
              <Input 
                type="number" 
                value={formData.minDeposit} 
                onChange={e => setFormData({...formData, minDeposit: e.target.value})}
                className="bg-background font-orbitron"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-orbitron text-lg">Referral Commissions</CardTitle>
            <CardDescription>Set percentage rates for each level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-orbitron text-xs text-purple-500">Level 1 Rate (%)</Label>
              <Input 
                type="number" 
                value={formData.level1Rate} 
                onChange={e => setFormData({...formData, level1Rate: e.target.value})}
                className="bg-background font-orbitron text-purple-500 border-purple-500/30"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-orbitron text-xs text-blue-500">Level 2 Rate (%)</Label>
              <Input 
                type="number" 
                value={formData.level2Rate} 
                onChange={e => setFormData({...formData, level2Rate: e.target.value})}
                className="bg-background font-orbitron text-blue-500 border-blue-500/30"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-orbitron text-xs text-green-500">Level 3 Rate (%)</Label>
              <Input 
                type="number" 
                value={formData.level3Rate} 
                onChange={e => setFormData({...formData, level3Rate: e.target.value})}
                className="bg-background font-orbitron text-green-500 border-green-500/30"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border md:col-span-2">
          <CardHeader>
            <CardTitle className="font-orbitron text-lg">System Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between border border-border p-4 rounded-lg bg-background">
              <div>
                <Label className="text-base font-orbitron text-destructive">Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">Disable access to the mini app for regular users</p>
              </div>
              <Switch 
                checked={formData.maintenanceMode} 
                onCheckedChange={c => setFormData({...formData, maintenanceMode: c})}
                className="data-[state=checked]:bg-destructive"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-orbitron text-xs text-muted-foreground">Welcome Message</Label>
              <Textarea 
                value={formData.welcomeMessage} 
                onChange={e => setFormData({...formData, welcomeMessage: e.target.value})}
                className="bg-background font-mono text-sm min-h-[100px]"
                placeholder="Message sent to new users by the bot..."
              />
            </div>
            
            <Button 
              className="w-full font-orbitron tracking-wider mt-4" 
              onClick={handleSave}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? "SAVING..." : "SAVE ALL SETTINGS"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
