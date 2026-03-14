import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, FileText, AlertTriangle, CheckCircle, Calendar, Download, Activity } from 'lucide-react';
import CCCard, { CCCardHeader, CCCardTitle, CCCardContent } from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCSelect from '@/components/ui-custom/CCSelect';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import { format, subDays, isAfter, isBefore, startOfMonth, endOfMonth } from 'date-fns';

const COLORS = ['#4F8CFF', '#FF2DAA', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function CollaborationAnalytics() {
  const [dateRange, setDateRange] = useState('30');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch all relevant data
  const { data: collaborations = [], isLoading: loadingCollabs } = useQuery({
    queryKey: ['analytics-collaborations'],
    queryFn: () => base44.entities.Collaboration.list(),
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['analytics-tasks'],
    queryFn: () => base44.entities.CollaborationTask.list(),
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['analytics-contracts'],
    queryFn: () => base44.entities.Contract.list(),
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['analytics-activities'],
    queryFn: () => base44.entities.CollaborationActivity.list(),
  });

  const { data: riskScores = [], isLoading: loadingRisk } = useQuery({
    queryKey: ['analytics-risk'],
    queryFn: () => base44.entities.CollaborationRiskScore.list(),
  });

  const { data: disputes = [], isLoading: loadingDisputes } = useQuery({
    queryKey: ['analytics-disputes'],
    queryFn: () => base44.entities.CollaborationDispute.list(),
  });

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['analytics-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const isLoading = loadingCollabs || loadingTasks || loadingContracts || loadingActivities || loadingRisk || loadingDisputes || loadingUsers;

  // Filter data by date range
  const filteredData = useMemo(() => {
    const cutoffDate = dateRange === 'all' ? new Date(0) : subDays(new Date(), parseInt(dateRange));
    
    const filtered = {
      collaborations: collaborations.filter(c => {
        const createdDate = new Date(c.created_date);
        const matchesDate = dateRange === 'all' || isAfter(createdDate, cutoffDate);
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        return matchesDate && matchesStatus;
      }),
      tasks: tasks.filter(t => dateRange === 'all' || isAfter(new Date(t.created_date), cutoffDate)),
      contracts: contracts.filter(c => dateRange === 'all' || isAfter(new Date(c.created_date), cutoffDate)),
      activities: activities.filter(a => dateRange === 'all' || isAfter(new Date(a.created_date), cutoffDate)),
      riskScores: riskScores.filter(r => dateRange === 'all' || isAfter(new Date(r.created_date), cutoffDate)),
      disputes: disputes.filter(d => dateRange === 'all' || isAfter(new Date(d.created_date), cutoffDate)),
    };

    return filtered;
  }, [collaborations, tasks, contracts, activities, riskScores, disputes, dateRange, statusFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalTasks = filteredData.tasks.length;
    const completedTasks = filteredData.tasks.filter(t => t.status === 'completed').length;
    const taskCompletionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

    const totalCollaborations = filteredData.collaborations.length;
    const activeCollaborations = filteredData.collaborations.filter(c => 
      ['active', 'negotiating', 'agreed'].includes(c.status)
    ).length;

    const totalContracts = filteredData.contracts.length;
    const signedContracts = filteredData.contracts.filter(c => c.status === 'signed').length;

    const avgEngagement = filteredData.collaborations.length > 0
      ? (filteredData.activities.length / filteredData.collaborations.length).toFixed(1)
      : 0;

    const highRiskCount = filteredData.riskScores.filter(r => r.risk_level === 'high').length;
    const activeDisputes = filteredData.disputes.filter(d => d.status === 'open').length;

    return {
      taskCompletionRate,
      completedTasks,
      totalTasks,
      totalCollaborations,
      activeCollaborations,
      totalContracts,
      signedContracts,
      avgEngagement,
      highRiskCount,
      activeDisputes,
    };
  }, [filteredData]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const statusCounts = {};
    filteredData.collaborations.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count,
    }));
  }, [filteredData.collaborations]);

  // Task completion trend (last 7 days)
  const taskTrend = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const tasksCompleted = filteredData.tasks.filter(t => {
        if (t.status !== 'completed') return false;
        const updatedDate = new Date(t.updated_date);
        return format(updatedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      }).length;
      days.push({
        date: format(date, 'MMM dd'),
        completed: tasksCompleted,
      });
    }
    return days;
  }, [filteredData.tasks]);

  // Contract status breakdown
  const contractStatus = useMemo(() => {
    const statusCounts = {};
    filteredData.contracts.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status.replace(/_/g, ' '),
      count,
    }));
  }, [filteredData.contracts]);

  // Risk assessment distribution
  const riskDistribution = useMemo(() => {
    const riskCounts = { low: 0, medium: 0, high: 0 };
    filteredData.riskScores.forEach(r => {
      riskCounts[r.risk_level.toLowerCase()] = (riskCounts[r.risk_level.toLowerCase()] || 0) + 1;
    });
    return Object.entries(riskCounts).map(([level, count]) => ({
      level: level.charAt(0).toUpperCase() + level.slice(1),
      count,
    }));
  }, [filteredData.riskScores]);

  // Collaboration growth over time (last 30 days)
  const collaborationGrowth = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = collaborations.filter(c => 
        format(new Date(c.created_date), 'yyyy-MM-dd') === dateStr
      ).length;
      days.push({ date: format(date, 'MMM d'), count });
    }
    // Cumulative
    let running = collaborations.filter(c => 
      isBefore(new Date(c.created_date), subDays(new Date(), 29))
    ).length;
    return days.map(d => { running += d.count; return { date: d.date, total: running, new: d.count }; });
  }, [collaborations]);

  // Disputes trend (last 30 days)
  const disputesTrend = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const opened = disputes.filter(d => format(new Date(d.created_date), 'yyyy-MM-dd') === dateStr).length;
      const resolved = disputes.filter(d => 
        d.resolved_at && format(new Date(d.resolved_at), 'yyyy-MM-dd') === dateStr
      ).length;
      days.push({ date: format(date, 'MMM d'), opened, resolved });
    }
    return days;
  }, [disputes]);

  // User activity (registrations) over time
  const userGrowth = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const newUsers = allUsers.filter(u =>
        u.created_date && format(new Date(u.created_date), 'yyyy-MM-dd') === dateStr
      ).length;
      days.push({ date: format(date, 'MMM d'), newUsers });
    }
    return days;
  }, [allUsers]);

  // User engagement by collaboration
  const engagementData = useMemo(() => {
    const engagementMap = {};
    filteredData.activities.forEach(a => {
      engagementMap[a.collaboration_id] = (engagementMap[a.collaboration_id] || 0) + 1;
    });
    
    return Object.entries(engagementMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([collabId, count]) => {
        const collab = filteredData.collaborations.find(c => c.id === collabId);
        return {
          name: collab?.collaboration_name?.substring(0, 20) || 'Unknown',
          activities: count,
        };
      });
  }, [filteredData.activities, filteredData.collaborations]);

  const handleExport = () => {
    const csvData = [
      ['Collaboration Analytics Report'],
      ['Generated:', new Date().toLocaleString()],
      ['Date Range:', dateRange === 'all' ? 'All Time' : `Last ${dateRange} days`],
      [''],
      ['Metric', 'Value'],
      ['Total Collaborations', metrics.totalCollaborations],
      ['Active Collaborations', metrics.activeCollaborations],
      ['Task Completion Rate', `${metrics.taskCompletionRate}%`],
      ['Total Contracts', metrics.totalContracts],
      ['Signed Contracts', metrics.signedContracts],
      ['Average Engagement', metrics.avgEngagement],
      ['High Risk Collaborations', metrics.highRiskCount],
      ['Active Disputes', metrics.activeDisputes],
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collaboration-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (isLoading) {
    return <CCLoadingScreen message="Loading analytics..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#E8EEF9]">Collaboration Analytics</h2>
          <p className="text-sm text-[#9AA6BC] mt-1">Comprehensive metrics and insights</p>
        </div>
        <CCButton variant="outline" icon={Download} onClick={handleExport}>
          Export Report
        </CCButton>
      </div>

      {/* Filters */}
      <CCCard padding="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CCSelect
            label="Date Range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </CCSelect>
          <CCSelect
            label="Status Filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="negotiating">Negotiating</option>
            <option value="agreed">Agreed</option>
            <option value="signed">Signed</option>
            <option value="completed">Completed</option>
            <option value="disputed">Disputed</option>
          </CCSelect>
        </div>
      </CCCard>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CCCard padding="lg" className="bg-gradient-to-br from-[#4F8CFF]/10 to-transparent border-[#4F8CFF]/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#9AA6BC]">Task Completion</p>
              <p className="text-3xl font-bold text-[#E8EEF9] mt-1">{metrics.taskCompletionRate}%</p>
              <p className="text-xs text-[#6B7A94] mt-1">
                {metrics.completedTasks} of {metrics.totalTasks} tasks
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-[#4F8CFF] opacity-50" />
          </div>
        </CCCard>

        <CCCard padding="lg" className="bg-gradient-to-br from-[#22C55E]/10 to-transparent border-[#22C55E]/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#9AA6BC]">Active Collaborations</p>
              <p className="text-3xl font-bold text-[#E8EEF9] mt-1">{metrics.activeCollaborations}</p>
              <p className="text-xs text-[#6B7A94] mt-1">
                of {metrics.totalCollaborations} total
              </p>
            </div>
            <Users className="w-10 h-10 text-[#22C55E] opacity-50" />
          </div>
        </CCCard>

        <CCCard padding="lg" className="bg-gradient-to-br from-[#FF2DAA]/10 to-transparent border-[#FF2DAA]/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#9AA6BC]">Signed Contracts</p>
              <p className="text-3xl font-bold text-[#E8EEF9] mt-1">{metrics.signedContracts}</p>
              <p className="text-xs text-[#6B7A94] mt-1">
                of {metrics.totalContracts} total
              </p>
            </div>
            <FileText className="w-10 h-10 text-[#FF2DAA] opacity-50" />
          </div>
        </CCCard>

        <CCCard padding="lg" className="bg-gradient-to-br from-[#F59E0B]/10 to-transparent border-[#F59E0B]/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#9AA6BC]">Avg Engagement</p>
              <p className="text-3xl font-bold text-[#E8EEF9] mt-1">{metrics.avgEngagement}</p>
              <p className="text-xs text-[#6B7A94] mt-1">
                activities per collaboration
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-[#F59E0B] opacity-50" />
          </div>
        </CCCard>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collaboration Status Distribution */}
        <CCCard padding="lg">
          <CCCardHeader>
            <CCCardTitle>Status Distribution</CCCardTitle>
          </CCCardHeader>
          <CCCardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CCCardContent>
        </CCCard>

        {/* Task Completion Trend */}
        <CCCard padding="lg">
          <CCCardHeader>
            <CCCardTitle>Task Completion Trend (7 Days)</CCCardTitle>
          </CCCardHeader>
          <CCCardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={taskTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263248" />
                <XAxis dataKey="date" stroke="#9AA6BC" />
                <YAxis stroke="#9AA6BC" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151D2B', border: '1px solid #263248' }}
                  labelStyle={{ color: '#E8EEF9' }}
                />
                <Line type="monotone" dataKey="completed" stroke="#4F8CFF" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CCCardContent>
        </CCCard>

        {/* Contract Status */}
        <CCCard padding="lg">
          <CCCardHeader>
            <CCCardTitle>Contract Status Overview</CCCardTitle>
          </CCCardHeader>
          <CCCardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={contractStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263248" />
                <XAxis dataKey="status" stroke="#9AA6BC" />
                <YAxis stroke="#9AA6BC" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151D2B', border: '1px solid #263248' }}
                  labelStyle={{ color: '#E8EEF9' }}
                />
                <Bar dataKey="count" fill="#FF2DAA" />
              </BarChart>
            </ResponsiveContainer>
          </CCCardContent>
        </CCCard>

        {/* Risk Assessment */}
        <CCCard padding="lg">
          <CCCardHeader>
            <CCCardTitle>Risk Assessment Distribution</CCCardTitle>
          </CCCardHeader>
          <CCCardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={riskDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263248" />
                <XAxis dataKey="level" stroke="#9AA6BC" />
                <YAxis stroke="#9AA6BC" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151D2B', border: '1px solid #263248' }}
                  labelStyle={{ color: '#E8EEF9' }}
                />
                <Bar dataKey="count">
                  {riskDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.level === 'High' ? '#EF4444' : 
                        entry.level === 'Medium' ? '#F59E0B' : 
                        '#22C55E'
                      } 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CCCardContent>
        </CCCard>
      </div>

      {/* NEW: Growth & Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collaboration Growth */}
        <CCCard padding="lg">
          <CCCardHeader>
            <CCCardTitle>Collaboration Growth (30 Days)</CCCardTitle>
          </CCCardHeader>
          <CCCardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={collaborationGrowth}>
                <defs>
                  <linearGradient id="collabGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F8CFF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4F8CFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#263248" />
                <XAxis dataKey="date" stroke="#9AA6BC" tick={{ fontSize: 10 }} interval={4} />
                <YAxis stroke="#9AA6BC" />
                <Tooltip contentStyle={{ backgroundColor: '#151D2B', border: '1px solid #263248' }} labelStyle={{ color: '#E8EEF9' }} />
                <Legend />
                <Area type="monotone" dataKey="total" name="Total" stroke="#4F8CFF" fill="url(#collabGrad)" strokeWidth={2} />
                <Bar dataKey="new" name="New Today" fill="#FF2DAA" />
              </AreaChart>
            </ResponsiveContainer>
          </CCCardContent>
        </CCCard>

        {/* Disputes Trend */}
        <CCCard padding="lg">
          <CCCardHeader>
            <CCCardTitle>Disputes Opened vs Resolved (30 Days)</CCCardTitle>
          </CCCardHeader>
          <CCCardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={disputesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263248" />
                <XAxis dataKey="date" stroke="#9AA6BC" tick={{ fontSize: 10 }} interval={4} />
                <YAxis stroke="#9AA6BC" />
                <Tooltip contentStyle={{ backgroundColor: '#151D2B', border: '1px solid #263248' }} labelStyle={{ color: '#E8EEF9' }} />
                <Legend />
                <Line type="monotone" dataKey="opened" name="Opened" stroke="#EF4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#22C55E" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CCCardContent>
        </CCCard>
      </div>

      {/* User Activity (New Registrations) */}
      <CCCard padding="lg">
        <CCCardHeader>
          <CCCardTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#FF2DAA]" />
            User Registrations (30 Days)
          </CCCardTitle>
        </CCCardHeader>
        <CCCardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={userGrowth}>
              <defs>
                <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF2DAA" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF2DAA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#263248" />
              <XAxis dataKey="date" stroke="#9AA6BC" tick={{ fontSize: 10 }} interval={4} />
              <YAxis stroke="#9AA6BC" />
              <Tooltip contentStyle={{ backgroundColor: '#151D2B', border: '1px solid #263248' }} labelStyle={{ color: '#E8EEF9' }} />
              <Area type="monotone" dataKey="newUsers" name="New Users" stroke="#FF2DAA" fill="url(#userGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CCCardContent>
      </CCCard>

      {/* Top Engaged Collaborations */}
      <CCCard padding="lg">
        <CCCardHeader>
          <CCCardTitle>Most Engaged Collaborations (Top 10)</CCCardTitle>
        </CCCardHeader>
        <CCCardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={engagementData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#263248" />
              <XAxis type="number" stroke="#9AA6BC" />
              <YAxis dataKey="name" type="category" stroke="#9AA6BC" width={150} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#151D2B', border: '1px solid #263248' }}
                labelStyle={{ color: '#E8EEF9' }}
              />
              <Bar dataKey="activities" fill="#4F8CFF" />
            </BarChart>
          </ResponsiveContainer>
        </CCCardContent>
      </CCCard>

      {/* Risk & Dispute Alerts */}
      {(metrics.highRiskCount > 0 || metrics.activeDisputes > 0) && (
        <CCCard padding="lg" className="border-[#EF4444]/30 bg-[#EF4444]/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#EF4444] mt-0.5" />
            <div>
              <h3 className="font-semibold text-[#E8EEF9]">Attention Required</h3>
              <div className="mt-2 space-y-2">
                {metrics.highRiskCount > 0 && (
                  <p className="text-sm text-[#9AA6BC]">
                    <CCBadge variant="danger" className="mr-2">{metrics.highRiskCount}</CCBadge>
                    high-risk collaborations require review
                  </p>
                )}
                {metrics.activeDisputes > 0 && (
                  <p className="text-sm text-[#9AA6BC]">
                    <CCBadge variant="danger" className="mr-2">{metrics.activeDisputes}</CCBadge>
                    active disputes need resolution
                  </p>
                )}
              </div>
            </div>
          </div>
        </CCCard>
      )}
    </div>
  );
}