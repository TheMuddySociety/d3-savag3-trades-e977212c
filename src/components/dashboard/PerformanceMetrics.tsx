
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LineChart, PieChart, Activity, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockPerformanceData, mockPortfolioData } from "@/lib/mock-data";

export function PerformanceMetrics() {
  return (
    <Card className="memecoin-card row-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Activity className="h-5 w-5 text-solana" />
          Market Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="performance" className="flex items-center gap-1">
              <LineChart className="h-4 w-4" />
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="distribution" className="flex items-center gap-1">
              <PieChart className="h-4 w-4" />
              <span>Distribution</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="performance" className="space-y-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={mockPerformanceData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14F195" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#14F195" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${value}k`}
                  />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccc" strokeOpacity={0.2} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.75)', 
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#14F195' }}
                    formatter={(value) => [`$${value}k`, 'Volume']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#14F195" 
                    fillOpacity={1} 
                    fill="url(#colorUv)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-background/50">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Total Memecoin Volume</div>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    $2.7B
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="text-xs text-green-500">+32% from last month</div>
                </CardContent>
              </Card>
              <Card className="bg-background/50">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">New Tokens (30d)</div>
                  <div className="text-2xl font-bold">1,256</div>
                  <div className="text-xs text-green-500">+152 from previous period</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="distribution">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={mockPortfolioData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRoi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#673AB7" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#673AB7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccc" strokeOpacity={0.2} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.75)', 
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#673AB7' }}
                    formatter={(value) => [`${value}%`, 'ROI']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#673AB7" 
                    fillOpacity={1} 
                    fill="url(#colorRoi)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Card className="bg-background/50">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Avg. Memecoin ROI</div>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    243%
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="text-xs text-green-500">Based on top 100 tokens</div>
                </CardContent>
              </Card>
              <Card className="bg-background/50">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                  <div className="text-2xl font-bold">38.5%</div>
                  <div className="text-xs text-muted-foreground">Tokens with positive ROI</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
