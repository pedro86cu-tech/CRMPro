import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';
import {
  Users,
  Mail,
  Ticket,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Phone,
  ShoppingCart,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  Zap,
  BarChart3
} from 'lucide-react';

interface Stats {
  totalClients: number;
  activeClients: number;
  newClientsThisMonth: number;
  clientGrowth: number;
  totalRevenue: number;
  revenueGrowth: number;
  pendingRevenue: number;
  openTickets: number;
  avgResolutionTime: number;
  ticketSatisfaction: number;
  totalCalls: number;
  avgCallDuration: number;
  campaignsActive: number;
  emailOpenRate: number;
  ordersThisMonth: number;
  conversionRate: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  time: string;
  icon: any;
  color: string;
}

export function DashboardModule() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    activeClients: 0,
    newClientsThisMonth: 0,
    clientGrowth: 0,
    totalRevenue: 0,
    revenueGrowth: 15.3,
    pendingRevenue: 0,
    openTickets: 0,
    avgResolutionTime: 0,
    ticketSatisfaction: 94,
    totalCalls: 0,
    avgCallDuration: 0,
    campaignsActive: 0,
    emailOpenRate: 68.5,
    ordersThisMonth: 0,
    conversionRate: 23.4
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);

  useEffect(() => {
    const initializeDashboard = async () => {
      await ensureCurrentUserInSystemUsers();
      loadDashboardData();
    };
    initializeDashboard();

    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000);

    const campaignsChannel = supabase
      .channel('dashboard-campaigns')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    const clientsChannel = supabase
      .channel('dashboard-clients')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(campaignsChannel);
      supabase.removeChannel(clientsChannel);
    };
  }, []);

  const loadDashboardData = async () => {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      clients,
      activeClients,
      newClientsThisMonth,
      newClientsLastMonth,
      invoices,
      pendingInvoices,
      tickets,
      calls,
      campaigns,
      campaignsThisMonth,
      orders,
      campaignLogs
    ] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', firstDayThisMonth.toISOString()),
      supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', firstDayLastMonth.toISOString()).lte('created_at', lastDayLastMonth.toISOString()),
      supabase.from('invoices').select('total_amount').eq('status', 'paid'),
      supabase.from('invoices').select('total_amount').in('status', ['sent', 'overdue']),
      supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
      supabase.from('calls').select('duration'),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).in('status', ['scheduled', 'sending']),
      supabase.from('campaigns').select('sent_count, failed_count').gte('created_at', firstDayThisMonth.toISOString()),
      supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', firstDayThisMonth.toISOString()),
      supabase.from('campaign_email_logs').select('status, sent_at, created_at').gte('created_at', firstDayThisMonth.toISOString())
    ]);

    const totalRevenue = invoices.data?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
    const pendingRevenue = pendingInvoices.data?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

    const totalCallDuration = calls.data?.reduce((sum, call) => sum + call.duration, 0) || 0;
    const avgCallDuration = calls.data?.length ? Math.floor(totalCallDuration / calls.data.length) : 0;

    const clientGrowth = newClientsLastMonth.count && newClientsLastMonth.count > 0
      ? ((newClientsThisMonth.count! - newClientsLastMonth.count) / newClientsLastMonth.count) * 100
      : 0;

    const totalEmailsSent = campaignLogs.data?.filter(log => log.status === 'sent').length || 0;
    const totalEmailsThisMonth = campaignLogs.data?.length || 0;
    const emailOpenRate = totalEmailsThisMonth > 0 ? (totalEmailsSent / totalEmailsThisMonth) * 100 : 0;

    const totalCampaignsThisMonth = campaignsThisMonth.data?.length || 0;

    setStats({
      totalClients: clients.count || 0,
      activeClients: activeClients.count || 0,
      newClientsThisMonth: newClientsThisMonth.count || 0,
      clientGrowth,
      totalRevenue,
      revenueGrowth: 15.3,
      pendingRevenue,
      openTickets: tickets.count || 0,
      avgResolutionTime: 4.5,
      ticketSatisfaction: 94,
      totalCalls: calls.data?.length || 0,
      avgCallDuration,
      campaignsActive: totalCampaignsThisMonth,
      emailOpenRate,
      ordersThisMonth: orders.count || 0,
      conversionRate: 23.4
    });

    await loadRecentActivity();
    await loadTopClients();
  };

  const loadRecentActivity = async () => {
    const activities: RecentActivity[] = [];

    const { data: recentClients } = await supabase
      .from('clients')
      .select('company_name, created_at')
      .order('created_at', { ascending: false })
      .limit(2);

    const { data: recentOrders } = await supabase
      .from('orders')
      .select('order_number, created_at')
      .order('created_at', { ascending: false })
      .limit(2);

    const { data: recentTickets } = await supabase
      .from('tickets')
      .select('ticket_number, status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(2);

    recentClients?.forEach(client => {
      activities.push({
        id: crypto.randomUUID(),
        type: 'client',
        description: `Nuevo cliente: ${client.company_name}`,
        time: new Date(client.created_at).toLocaleString(),
        icon: Users,
        color: 'blue'
      });
    });

    recentOrders?.forEach(order => {
      activities.push({
        id: crypto.randomUUID(),
        type: 'order',
        description: `Nueva orden: ${order.order_number}`,
        time: new Date(order.created_at).toLocaleString(),
        icon: ShoppingCart,
        color: 'green'
      });
    });

    recentTickets?.forEach(ticket => {
      activities.push({
        id: crypto.randomUUID(),
        type: 'ticket',
        description: `Ticket ${ticket.ticket_number} - ${ticket.status}`,
        time: new Date(ticket.updated_at).toLocaleString(),
        icon: Ticket,
        color: 'orange'
      });
    });

    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setRecentActivity(activities.slice(0, 8));
  };

  const loadTopClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, contact_name')
      .eq('status', 'active')
      .limit(5);

    if (data) {
      const clientsWithRevenue = await Promise.all(
        data.map(async (client) => {
          const { data: invoices } = await supabase
            .from('invoices')
            .select('total_amount')
            .eq('client_id', client.id)
            .eq('status', 'paid');

          const revenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
          return { ...client, revenue };
        })
      );

      setTopClients(clientsWithRevenue.sort((a, b) => b.revenue - a.revenue));
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          Dashboard Ejecutivo
        </h1>
        <p className="text-slate-600 mt-2 text-sm sm:text-base lg:text-lg">Vista completa del rendimiento de tu negocio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Users className="w-8 h-8" />
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-1">
                {stats.clientGrowth >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">{Math.abs(stats.clientGrowth).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-blue-100 text-sm font-medium">Total Clientes</p>
            <p className="text-4xl font-bold">{stats.totalClients}</p>
            <p className="text-blue-100 text-xs">
              {stats.newClientsThisMonth} nuevos este mes
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <DollarSign className="w-8 h-8" />
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">{stats.revenueGrowth.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-green-100 text-sm font-medium">Ingresos Totales</p>
            <p className="text-4xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
            <p className="text-green-100 text-xs">
              ${stats.pendingRevenue.toLocaleString()} pendiente
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Ticket className="w-8 h-8" />
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-1">
                <Target className="w-4 h-4" />
                <span className="text-sm font-medium">{stats.ticketSatisfaction}%</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-orange-100 text-sm font-medium">Tickets Abiertos</p>
            <p className="text-4xl font-bold">{stats.openTickets}</p>
            <p className="text-orange-100 text-xs">
              Tiempo promedio: {stats.avgResolutionTime}h
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Mail className="w-8 h-8" />
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-1">
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">{stats.emailOpenRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-purple-100 text-sm font-medium">Campañas Este Mes</p>
            <p className="text-4xl font-bold">{stats.campaignsActive}</p>
            <p className="text-purple-100 text-xs">
              {stats.emailOpenRate.toFixed(1)}% tasa de éxito
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Actividad de Llamadas</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Total de Llamadas</span>
              <span className="text-2xl font-bold text-slate-900">{stats.totalCalls}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Duración Promedio</span>
              <span className="text-2xl font-bold text-blue-600">{formatDuration(stats.avgCallDuration)}</span>
            </div>
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Efectividad</span>
                <span className="text-green-600 font-semibold">85%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-green-100 p-2 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Órdenes del Mes</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Total Órdenes</span>
              <span className="text-2xl font-bold text-slate-900">{stats.ordersThisMonth}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Tasa de Conversión</span>
              <span className="text-2xl font-bold text-green-600">{stats.conversionRate}%</span>
            </div>
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Meta Mensual</span>
                <span className="text-blue-600 font-semibold">75/100</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Métricas Clave</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600 text-sm">Clientes Activos</span>
              <span className="text-lg font-bold text-slate-900">{stats.activeClients}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600 text-sm">Satisfacción</span>
              <span className="text-lg font-bold text-green-600">{stats.ticketSatisfaction}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600 text-sm">Tasa Éxito Emails</span>
              <span className="text-lg font-bold text-purple-600">{stats.emailOpenRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6">
            <div className="flex items-center space-x-3">
              <Activity className="w-6 h-6 text-white" />
              <h2 className="text-xl font-bold text-white">Actividad Reciente</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {recentActivity.map((activity) => {
                const Icon = activity.icon;
                const colorClasses = {
                  blue: 'bg-blue-100 text-blue-600',
                  green: 'bg-green-100 text-green-600',
                  orange: 'bg-orange-100 text-orange-600',
                  purple: 'bg-purple-100 text-purple-600'
                };

                return (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-slate-50 rounded-lg transition">
                    <div className={`${colorClasses[activity.color as keyof typeof colorClasses]} p-2 rounded-lg`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{activity.description}</p>
                      <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-6 h-6 text-white" />
              <h2 className="text-xl font-bold text-white">Top Clientes</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {topClients.map((client, index) => (
                <div key={client.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 hover:shadow-md transition">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{client.company_name}</p>
                      <p className="text-sm text-slate-500">{client.contact_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">${client.revenue.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Ingresos</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle className="w-8 h-8" />
            <span className="text-3xl font-bold">92%</span>
          </div>
          <p className="text-cyan-100">Tasa de Retención</p>
        </div>

        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <Clock className="w-8 h-8" />
            <span className="text-3xl font-bold">2.3h</span>
          </div>
          <p className="text-pink-100">Tiempo Respuesta Prom.</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <AlertCircle className="w-8 h-8" />
            <span className="text-3xl font-bold">3</span>
          </div>
          <p className="text-amber-100">Tickets Urgentes</p>
        </div>
      </div>
    </div>
  );
}
