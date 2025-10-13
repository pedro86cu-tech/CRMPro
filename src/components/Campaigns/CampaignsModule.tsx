import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Mail, Users, Send, Edit2, Trash2, BarChart3, Eye, TrendingUp,
  MousePointerClick, Activity, Clock, CheckCircle, AlertCircle, Zap, UserPlus,
  X, Calendar, FileText, Target, Layers, Hash, List
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { HTMLTemplateEditor } from './HTMLTemplateEditor';
import { ContactsManager } from './ContactsManager';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { CampaignMonitorModal } from './CampaignMonitorModal';

interface Campaign {
  id: string;
  name: string;
  status: string;
  created_at: string;
  template_id: string;
  group_id: string;
  scheduled_at?: string;
  email_templates?: { name: string };
  contact_groups?: { name: string };
}

interface CampaignStats {
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

export function CampaignsModule() {
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'templates' | 'groups'>('overview');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignStats, setCampaignStats] = useState<Record<string, CampaignStats>>({});
  const [overallStats, setOverallStats] = useState<CampaignStats>({
    totalSent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    openRate: 0,
    clickRate: 0
  });

  const [showHTMLEditor, setShowHTMLEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showContactsManager, setShowContactsManager] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showMonitorModal, setShowMonitorModal] = useState(false);
  const [monitoringCampaign, setMonitoringCampaign] = useState<Campaign | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {}
  });

  const { user } = useAuth();
  const toast = useToast();

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    template_id: '',
    group_id: '',
    status: 'draft',
    scheduled_at: ''
  });

  const [groupForm, setGroupForm] = useState({
    name: '',
    description: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);

    // Subscribe to real-time campaign updates
    const campaignChannel = supabase
      .channel('campaigns-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(campaignChannel);
    };
  }, []);

  const loadData = async () => {
    const [campaignsData, templatesData, groupsData, analyticsData] = await Promise.all([
      supabase.from('campaigns').select('*, email_templates(name), contact_groups(name)').order('created_at', { ascending: false }),
      supabase.from('email_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('contact_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('campaign_analytics').select('*')
    ]);

    if (campaignsData.data) setCampaigns(campaignsData.data);
    if (templatesData.data) setTemplates(templatesData.data);
    if (groupsData.data) setGroups(groupsData.data);

    if (analyticsData.data && campaignsData.data) {
      const statsByCampaign: Record<string, CampaignStats> = {};
      let totalSent = 0, totalDelivered = 0, totalOpened = 0, totalClicked = 0, totalBounced = 0;

      campaignsData.data.forEach(campaign => {
        const campaignAnalytics = analyticsData.data!.filter(a => a.campaign_id === campaign.id);
        const sent = campaignAnalytics.length;
        const delivered = campaignAnalytics.filter(a => !a.bounced).length;
        const opened = campaignAnalytics.filter(a => a.opened_at).length;
        const clicked = campaignAnalytics.filter(a => a.clicked_at).length;
        const bounced = campaignAnalytics.filter(a => a.bounced).length;

        statsByCampaign[campaign.id] = {
          totalSent: sent,
          delivered,
          opened,
          clicked,
          bounced,
          openRate: sent > 0 ? (opened / sent) * 100 : 0,
          clickRate: sent > 0 ? (clicked / sent) * 100 : 0
        };

        totalSent += sent;
        totalDelivered += delivered;
        totalOpened += opened;
        totalClicked += clicked;
        totalBounced += bounced;
      });

      setCampaignStats(statsByCampaign);
      setOverallStats({
        totalSent,
        delivered: totalDelivered,
        opened: totalOpened,
        clicked: totalClicked,
        bounced: totalBounced,
        openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0
      });
    }
  };

  const validateCampaignForm = () => {
    const newErrors: Record<string, string> = {};
    if (!campaignForm.name.trim()) newErrors.name = 'El nombre es requerido';
    if (!campaignForm.template_id) newErrors.template_id = 'Selecciona una plantilla';
    if (!campaignForm.group_id) newErrors.group_id = 'Selecciona un grupo';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCampaignForm()) return;

    try {
      if (editingCampaign) {
        const { error } = await supabase
          .from('campaigns')
          .update(campaignForm)
          .eq('id', editingCampaign.id);

        if (error) {
          toast.error(`Error al actualizar: ${error.message}`);
          return;
        }

        toast.success('Campaña actualizada correctamente');
      } else {
        const campaignData: any = { ...campaignForm };
        if (user?.id) {
          campaignData.created_by = user.id;
        }

        const { error } = await supabase
          .from('campaigns')
          .insert(campaignData);

        if (error) {
          toast.error(`Error al crear: ${error.message}`);
          return;
        }

        toast.success('Campaña creada correctamente');
      }

      loadData();
      resetCampaignForm();
    } catch (err) {
      toast.error('Error inesperado al guardar la campaña');
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) {
      toast.error('El nombre del grupo es requerido');
      return;
    }

    try {
      const groupData: any = { ...groupForm };
      if (user?.id) {
        groupData.created_by = user.id;
      }

      const { error } = await supabase
        .from('contact_groups')
        .insert(groupData);

      if (error) {
        toast.error(`Error al crear grupo: ${error.message}`);
        return;
      }

      toast.success('Grupo creado correctamente');
      loadData();
      resetGroupForm();
    } catch (err) {
      toast.error('Error inesperado al guardar el grupo');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar campaña?',
      message: 'Esta acción no se puede deshacer. La campaña y sus datos se eliminarán permanentemente.',
      type: 'danger',
      onConfirm: async () => {
        await supabase.from('campaigns').delete().eq('id', id);
        toast.success('Campaña eliminada correctamente');
        loadData();
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleDeleteTemplate = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar plantilla?',
      message: 'Esta plantilla se eliminará permanentemente. Las campañas que la usen podrían verse afectadas.',
      type: 'danger',
      onConfirm: async () => {
        await supabase.from('email_templates').delete().eq('id', id);
        toast.success('Plantilla eliminada correctamente');
        loadData();
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleDeleteGroup = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar grupo?',
      message: 'Este grupo y todos sus contactos se eliminarán permanentemente.',
      type: 'danger',
      onConfirm: async () => {
        await supabase.from('contact_groups').delete().eq('id', id);
        toast.success('Grupo eliminado correctamente');
        loadData();
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name,
      template_id: campaign.template_id,
      group_id: campaign.group_id,
      status: campaign.status,
      scheduled_at: campaign.scheduled_at || ''
    });
    setShowCampaignModal(true);
  };

  const resetCampaignForm = () => {
    setCampaignForm({ name: '', template_id: '', group_id: '', status: 'draft', scheduled_at: '' });
    setEditingCampaign(null);
    setShowCampaignModal(false);
    setErrors({});
  };

  const resetGroupForm = () => {
    setGroupForm({ name: '', description: '' });
    setShowGroupModal(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'sending': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'scheduled': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'paused': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="w-4 h-4" />;
      case 'sending': return <Zap className="w-4 h-4" />;
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'draft': return <FileText className="w-4 h-4" />;
      case 'paused': return <AlertCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Enviar campaña ahora?',
      message: 'Se enviará esta campaña a todos los contactos del grupo seleccionado. Esta acción no se puede deshacer.',
      type: 'warning',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });

        try {
          toast.success('Iniciando envío de campaña...');

          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign-emails`;
          const headers = {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          };

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ campaign_id: campaignId })
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Error al enviar campaña');
          }

          toast.success(result.message || 'Campaña enviada correctamente');
          loadData();
        } catch (error: any) {
          toast.error(error.message || 'Error al enviar la campaña');
        }
      }
    });
  };

  const handleRetryFailedEmails = async (campaignId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Reintentar envíos fallidos?',
      message: 'Se reintentará el envío solo de los correos que fallaron. Asegúrate de haber corregido cualquier problema de configuración SMTP.',
      type: 'warning',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });

        try {
          toast.success('Reintentando envíos fallidos...');

          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign-emails`;
          const headers = {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          };

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              campaign_id: campaignId,
              retry_failed: true
            })
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Error al reintentar envío');
          }

          toast.success(result.message || 'Reintento de envío iniciado');
          loadData();
        } catch (error: any) {
          toast.error(error.message || 'Error al reintentar el envío');
        }
      }
    });
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
          Campañas de Marketing
        </h1>
        <p className="text-slate-600 text-lg">Crea y gestiona tus campañas de email marketing</p>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-xl">
                  <Send className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-slate-600 text-sm font-medium mb-1">Total Enviados</p>
              <p className="text-3xl font-bold text-slate-900">{overallStats.totalSent.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl">
                  <Eye className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-slate-600 text-sm font-medium mb-1">Tasa de Apertura</p>
              <p className="text-3xl font-bold text-slate-900">{overallStats.openRate.toFixed(1)}%</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-3 rounded-xl">
                  <MousePointerClick className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-slate-600 text-sm font-medium mb-1">Tasa de Clicks</p>
              <p className="text-3xl font-bold text-slate-900">{overallStats.clickRate.toFixed(1)}%</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-orange-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-xl">
                  <Activity className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-slate-600 text-sm font-medium mb-1">Campañas Activas</p>
              <p className="text-3xl font-bold text-slate-900">{campaigns.filter(c => c.status === 'sending' || c.status === 'scheduled').length}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Navegación Rápida</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('campaigns')}
                className="flex items-center space-x-4 p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all border border-purple-200"
              >
                <div className="bg-purple-600 p-3 rounded-xl">
                  <Send className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-900">Campañas</p>
                  <p className="text-sm text-slate-600">{campaigns.length} campañas</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('templates')}
                className="flex items-center space-x-4 p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all border border-blue-200"
              >
                <div className="bg-blue-600 p-3 rounded-xl">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-900">Plantillas</p>
                  <p className="text-sm text-slate-600">{templates.length} plantillas</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('groups')}
                className="flex items-center space-x-4 p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl hover:from-emerald-100 hover:to-emerald-200 transition-all border border-emerald-200"
              >
                <div className="bg-emerald-600 p-3 rounded-xl">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-900">Grupos</p>
                  <p className="text-sm text-slate-600">{groups.length} grupos</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'campaigns' && (
        <>
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Mis Campañas</h2>
              <button
                onClick={() => setShowCampaignModal(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5" />
                <span className="font-semibold">Nueva Campaña</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-all">
                <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 mb-2">{campaign.name}</h3>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center space-x-1 ${getStatusColor(campaign.status)}`}>
                          {getStatusIcon(campaign.status)}
                          <span className="ml-1">{campaign.status}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 text-sm text-slate-600">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-blue-500" />
                      <span>Plantilla: {campaign.email_templates?.name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2 text-emerald-500" />
                      <span>Grupo: {campaign.contact_groups?.name || 'N/A'}</span>
                    </div>
                  </div>

                  {campaignStats[campaign.id] && (
                    <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl mb-4">
                      <div className="text-center">
                        <p className="text-xs text-slate-500 mb-1">Enviados</p>
                        <p className="text-lg font-bold text-slate-900">{campaignStats[campaign.id].totalSent}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-500 mb-1">Aperturas</p>
                        <p className="text-lg font-bold text-blue-600">{campaignStats[campaign.id].openRate.toFixed(1)}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-500 mb-1">Clicks</p>
                        <p className="text-lg font-bold text-emerald-600">{campaignStats[campaign.id].clickRate.toFixed(1)}%</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                      <button
                        onClick={() => handleSendCampaign(campaign.id)}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg"
                      >
                        <Send className="w-5 h-5" />
                        <span className="font-semibold">Enviar Campaña</span>
                      </button>
                    )}

                    {(campaign.status === 'sending' || campaign.status === 'sent') && (
                      <>
                        <button
                          onClick={() => {
                            setMonitoringCampaign(campaign);
                            setShowMonitorModal(true);
                          }}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
                        >
                          <List className="w-5 h-5" />
                          <span className="font-semibold">Ver Logs de Envío</span>
                        </button>

                        {campaign.failed_count > 0 && (
                          <button
                            onClick={() => handleRetryFailedEmails(campaign.id)}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
                          >
                            <Send className="w-5 h-5" />
                            <span className="font-semibold">Reintentar Fallidos ({campaign.failed_count})</span>
                          </button>
                        )}
                      </>
                    )}

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditCampaign(campaign)}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition-colors border border-purple-200"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Editar</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Eliminar</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'templates' && (
        <>
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Plantillas de Email</h2>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowHTMLEditor(true);
                }}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5" />
                <span className="font-semibold">Nueva Plantilla</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div key={template.id} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-all">
                <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{template.name}</h3>
                      <p className="text-sm text-slate-500">{template.subject}</p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingTemplate(template);
                        setShowHTMLEditor(true);
                      }}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors border border-blue-200"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Editar</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'groups' && (
        <>
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Grupos de Contactos</h2>
              <button
                onClick={() => setShowGroupModal(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5" />
                <span className="font-semibold">Nuevo Grupo</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div key={group.id} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-all">
                <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{group.name}</h3>
                      <p className="text-sm text-slate-500">{group.description || 'Sin descripción'}</p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setShowContactsManager(true);
                      }}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-200"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span className="text-sm font-medium">Contactos</span>
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 flex space-x-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-5 h-5 inline mr-2" />
            Resumen
          </button>
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'campaigns'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Send className="w-5 h-5 inline mr-2" />
            Campañas
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'templates'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-5 h-5 inline mr-2" />
            Plantillas
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'groups'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-5 h-5 inline mr-2" />
            Grupos
          </button>
        </div>
      </div>

      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {editingCampaign ? 'Editar Campaña' : 'Nueva Campaña'}
                  </h2>
                  <p className="text-purple-100 text-sm mt-1">
                    Configura tu campaña de email marketing
                  </p>
                </div>
                <button onClick={resetCampaignForm} className="text-white hover:bg-white/20 p-2 rounded-xl transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCampaignSubmit} className="p-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Target className="w-4 h-4 inline mr-2 text-purple-600" />
                    Nombre de la Campaña *
                  </label>
                  <input
                    type="text"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.name ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition`}
                    placeholder="Ej: Lanzamiento Primavera 2024"
                  />
                  {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <FileText className="w-4 h-4 inline mr-2 text-blue-600" />
                    Plantilla de Email *
                  </label>
                  <select
                    value={campaignForm.template_id}
                    onChange={(e) => setCampaignForm({ ...campaignForm, template_id: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.template_id ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition`}
                  >
                    <option value="">Selecciona una plantilla</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {errors.template_id && <p className="text-red-600 text-xs mt-1">{errors.template_id}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Users className="w-4 h-4 inline mr-2 text-emerald-600" />
                    Grupo de Contactos *
                  </label>
                  <select
                    value={campaignForm.group_id}
                    onChange={(e) => setCampaignForm({ ...campaignForm, group_id: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.group_id ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition`}
                  >
                    <option value="">Selecciona un grupo</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  {errors.group_id && <p className="text-red-600 text-xs mt-1">{errors.group_id}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Activity className="w-4 h-4 inline mr-2 text-orange-600" />
                    Estado
                  </label>
                  <select
                    value={campaignForm.status}
                    onChange={(e) => setCampaignForm({ ...campaignForm, status: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  >
                    <option value="draft">Borrador</option>
                    <option value="scheduled">Programada</option>
                    <option value="sending">Enviando</option>
                    <option value="sent">Enviada</option>
                    <option value="paused">Pausada</option>
                  </select>
                </div>

                {campaignForm.status === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-2 text-purple-600" />
                      Fecha y Hora Programada
                    </label>
                    <input
                      type="datetime-local"
                      value={campaignForm.scheduled_at}
                      onChange={(e) => setCampaignForm({ ...campaignForm, scheduled_at: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    />
                  </div>
                )}
              </div>

              <div className="flex space-x-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetCampaignForm}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl font-medium"
                >
                  {editingCampaign ? 'Actualizar' : 'Crear Campaña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Nuevo Grupo de Contactos</h2>
                  <p className="text-emerald-100 text-sm mt-1">Crea un grupo para organizar tus contactos</p>
                </div>
                <button onClick={resetGroupForm} className="text-white hover:bg-white/20 p-2 rounded-xl transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleGroupSubmit} className="p-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Users className="w-4 h-4 inline mr-2 text-emerald-600" />
                    Nombre del Grupo *
                  </label>
                  <input
                    type="text"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    placeholder="Ej: Clientes Premium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <FileText className="w-4 h-4 inline mr-2 text-blue-600" />
                    Descripción
                  </label>
                  <textarea
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    rows={3}
                    placeholder="Describe el propósito de este grupo..."
                  />
                </div>
              </div>

              <div className="flex space-x-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetGroupForm}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl font-medium"
                >
                  Crear Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHTMLEditor && (
        <HTMLTemplateEditor
          template={editingTemplate}
          onClose={() => {
            setShowHTMLEditor(false);
            setEditingTemplate(null);
            loadData();
          }}
        />
      )}

      {showContactsManager && selectedGroupId && (
        <ContactsManager
          groupId={selectedGroupId}
          onClose={() => {
            setShowContactsManager(false);
            setSelectedGroupId(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText={confirmDialog.type === 'danger' ? 'Eliminar' : 'Confirmar'}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />

      {showMonitorModal && monitoringCampaign && (
        <CampaignMonitorModal
          campaignId={monitoringCampaign.id}
          campaignName={monitoringCampaign.name}
          onClose={() => {
            setShowMonitorModal(false);
            setMonitoringCampaign(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
