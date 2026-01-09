/**
 * Usage Statistics Page
 *
 * Displays usage statistics with charts and analytics
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Activity, Database, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

interface UsageStats {
  summary: {
    total: number;
    count: number;
    startDate: string;
    endDate: string;
  };
  byType: Array<{
    type: string;
    label: string;
    quantity: number;
    count: number;
    formatted: string;
  }>;
  timeSeries: Array<{
    date: string;
    quantity: number;
    count: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    label: string;
    quantity: number;
    createdAt: string;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

export default function UsageStatsPage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30);

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, dateRange);

      const response = await fetch(
        `/api/usage/stats?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data);
    } catch (error) {
      toast.error('Failed to load usage statistics');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const topUsageTypes = stats.byType.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usage Statistics</h2>
          <p className="text-muted-foreground">
            Monitor your usage across all services
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={dateRange === 7 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange(7)}
          >
            7 Days
          </Button>
          <Button
            variant={dateRange === 30 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange(30)}
          >
            30 Days
          </Button>
          <Button
            variant={dateRange === 90 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange(90)}
          >
            90 Days
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {topUsageTypes.map((type, index) => {
          const icons = [TrendingUp, Activity, Database, ImageIcon];
          const Icon = icons[index] || Activity;

          return (
            <Card key={type.type}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {type.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{type.quantity.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {type.count} operations
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Usage by Type - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Distribution</CardTitle>
            <CardDescription>
              Breakdown by service type
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.byType.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.byType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.label}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="quantity"
                  >
                    {stats.byType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time Series - Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Over Time</CardTitle>
            <CardDescription>
              Daily usage trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.timeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MM/dd')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="quantity"
                    stroke="#8884d8"
                    activeDot={{ r: 8 }}
                    name="Usage"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No time series data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest usage logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{activity.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(activity.createdAt), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{activity.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No recent activity
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
