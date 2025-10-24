import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Settings, Plus, Save, X, Eye, EyeOff, TestTube,
  FileText, Shield, Key, Globe
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { FieldMapper } from './FieldMapper';
import { REQUEST_AVAILABLE_FIELDS, RESPONSE_AVAILABLE_FIELDS, DGI_URUGUAY_TEMPLATE } from './availableFields';

interface APIConfig {
  id: string;
  name: string;
  api_url: string;
  auth_type: 'basic' | 'bearer' | 'api_key' | 'none';
  auth_credentials: any;
  request_mapping: any;
  response_mapping: any;
  headers: any;
  timeout: number;
  retry_attempts: number;
  is_active: boolean;
  config_type: 'validation' | 'pdf_generation';
  created_at: string;
  updated_at: string;
}

interface ValidationLog {
  id: string;
  invoice_id: string;
  config_id: string;
  request_payload: any;
  response_payload: any;
  status_code: number;
  status: string;
  error_message: string;
  validation_result: string;
  external_reference: string;
  duration_ms: number;
  retry_count: number;
  created_at: string;
}

export function ExternalValidationModule() {
  const [configs, setConfigs] = useState<APIConfig[]>([]);
  const [logs, setLogs] = useState<ValidationLog[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<APIConfig | null>(null);
  const [selectedLog, setSelectedLog] = useState<ValidationLog | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'logs'>('config');
  const [testInvoiceId, setTestInvoiceId] = useState('');
  const [testing, setTesting] = useState(false);
  const [useVisualMapper, setUseVisualMapper] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const logsPerPage = 10;

  const { user } = useAuth();
  const toast = useToast();

  const [formData, setFormData] = useState<Partial<APIConfig>>({
    name: '',
    api_url: '',
    auth_type: 'none',
    auth_credentials: {},
    request_mapping: {},
    response_mapping: {},
    headers: {},
    timeout: 30000,
    retry_attempts: 3,
    is_active: true,
    config_type: 'validation',
  });

  useEffect(() => {
    fetchConfigs();
    fetchLogs(currentPage);
    fetchInvoices();
  }, [currentPage]);

  const fetchConfigs = async () => {
    const { data, error } = await supabase
      .from('external_invoice_api_config')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setConfigs(data);
    }
  };

  const fetchLogs = async (page: number = 1) => {
    const from = (page - 1) * logsPerPage;
    const to = from + logsPerPage - 1;

    const { data, error, count } = await supabase
      .from('external_invoice_validation_log')
      .select(`
        *,
        config:external_invoice_api_config(name, config_type)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      setLogs(data);
      setTotalLogs(count || 0);
    }
  };

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, numero_cfe, clients(contact_name, company_name)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setInvoices(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const dataToSave = {
        ...formData,
        updated_by: user?.email,
      };

      if (selectedConfig) {
        const { error } = await supabase
          .from('external_invoice_api_config')
          .update(dataToSave)
          .eq('id', selectedConfig.id);

        if (error) throw error;
        toast.success('Configuración actualizada exitosamente');
      } else {
        const { error } = await supabase
          .from('external_invoice_api_config')
          .insert({
            ...dataToSave,
            created_by: user?.email,
          });

        if (error) throw error;
        toast.success('Configuración creada exitosamente');
      }

      setShowConfigModal(false);
      setSelectedConfig(null);
      fetchConfigs();
    } catch (error: any) {
      toast.error('Error al guardar configuración: ' + error.message);
    }
  };

  const handleEdit = (config: APIConfig) => {
    setSelectedConfig(config);
    setFormData(config);
    setShowConfigModal(true);
  };

  const loadDGITemplate = () => {
    setFormData({
      ...formData,
      request_mapping: DGI_URUGUAY_TEMPLATE.request,
      response_mapping: DGI_URUGUAY_TEMPLATE.response,
    });
    toast.success('Template DGI Uruguay cargado');
  };

  const handleTest = async () => {
    if (!testInvoiceId) {
      toast.error('Por favor selecciona una factura para probar');
      return;
    }

    setTesting(true);

    try {
      const isPdfConfig = selectedConfig?.config_type === 'pdf_generation';
      const functionName = isPdfConfig ? 'send-invoice-pdf' : 'validate-invoice-external';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          invoice_id: testInvoiceId,
          config_id: selectedConfig?.id,
        },
      });

      if (error) {
        console.error('Error en edge function:', error);
        toast.error(`Error al llamar a la función: ${error.message}`);
        return;
      }

      const logTitle = isPdfConfig ? 'GENERACIÓN DE PDF' : 'VALIDACIÓN DGI';

      console.group(`📤 REQUEST ENVIADO - ${logTitle}`);
      console.log('🔹 Factura ID:', testInvoiceId);
      console.log('🔹 Config ID:', selectedConfig?.id);
      console.log('🔹 Tipo:', isPdfConfig ? 'PDF Generation' : 'DGI Validation');
      if (data?.request_payload) {
        console.log('🔹 JSON enviado:');
        console.log(JSON.stringify(data.request_payload, null, 2));
      }
      console.groupEnd();

      console.group(`📥 RESPONSE RECIBIDA - ${logTitle}`);
      console.log('🔹 Status Code:', data?.status_code);
      console.log('🔹 Success:', data?.success);
      if (isPdfConfig && data?.pdf_id) {
        console.log('🔹 PDF ID:', data.pdf_id);
      } else if (!isPdfConfig && data?.validation_result) {
        console.log('🔹 Validation Result:', data.validation_result);
      }
      if (data?.response_payload) {
        console.log('🔹 JSON recibido:');
        console.log(JSON.stringify(data.response_payload, null, 2));
      }
      console.groupEnd();

      if (data?.success) {
        if (isPdfConfig) {
          toast.success(`✅ PDF enviado exitosamente! ${data.pdf_id ? `ID: ${data.pdf_id}` : ''}`);
        } else {
          const result = data.validation_result || 'pendiente';
          toast.success(`✅ Validación exitosa! Estado: ${result}`);
        }

        if (data.external_reference || data.pdf_id) {
          console.log('✅ Referencia externa:', data.external_reference || data.pdf_id);
        }
      } else {
        const errorMsg = data?.error || data?.message || 'Error desconocido';
        const statusCode = data?.status_code;

        if (statusCode === 500) {
          toast.error(`❌ Error del servidor (HTTP 500). La API externa tiene problemas. Revisa los logs para más detalles.`);
        } else if (statusCode === 401 || statusCode === 403) {
          toast.error(`❌ Error de autenticación (HTTP ${statusCode}). Verifica las credenciales en la configuración.`);
        } else if (statusCode === 400) {
          toast.error(`❌ Request inválido (HTTP 400). Verifica el mapeo de campos en la configuración.`);
        } else if (statusCode === 404) {
          toast.error(`❌ Endpoint no encontrado (HTTP 404). Verifica la URL de la API.`);
        } else {
          toast.error(`❌ Error: ${errorMsg} ${statusCode ? `(HTTP ${statusCode})` : ''}`);
        }

        console.group('🔍 Detalles del Error');
        console.error('Error completo:', data);
        console.log('Status code:', statusCode);
        console.log('Mensaje:', errorMsg);
        if (data?.request_payload) {
          console.log('Request enviado:', data.request_payload);
        }
        if (data?.response_payload) {
          console.log('Response recibida:', data.response_payload);
        }
        console.groupEnd();
      }

      fetchLogs();
      fetchInvoices();
    } catch (error: any) {
      console.error('Error completo:', error);
      toast.error(`Error inesperado: ${error.message || 'Verifica la consola para más detalles'}`);
    } finally {
      setTesting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'timeout': return 'text-orange-600 bg-orange-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getValidationResultColor = (result: string) => {
    switch (result) {
      case 'approved': return 'text-green-600 bg-green-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Shield className="mr-3 text-teal-600" size={32} />
            Validación y Envío de Facturas
          </h1>
          <p className="text-slate-600 mt-1">Configure la integración con DGI y sistemas de generación de PDFs</p>
        </div>
        <button
          onClick={() => {
            setSelectedConfig(null);
            setFormData({
              name: '',
              api_url: '',
              auth_type: 'none',
              auth_credentials: {},
              request_mapping: {},
              response_mapping: {},
              headers: {},
              timeout: 30000,
              retry_attempts: 3,
              is_active: true,
              config_type: 'validation',
            });
            setShowConfigModal(true);
          }}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Nueva Configuración</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('config')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'config'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Settings className="inline mr-2" size={18} />
              Configuración
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'logs'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <FileText className="inline mr-2" size={18} />
              Historial de Validaciones
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'config' && (
        <div className="grid grid-cols-1 gap-6">
          {configs.map((config) => (
            <div key={config.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-slate-900">{config.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      config.config_type === 'pdf_generation' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {config.config_type === 'pdf_generation' ? 'Generación PDF' : 'Validación DGI'}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      config.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {config.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">URL de API</p>
                      <p className="text-sm font-medium text-slate-900 flex items-center">
                        <Globe size={14} className="mr-1" />
                        {config.api_url}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Tipo de Autenticación</p>
                      <p className="text-sm font-medium text-slate-900 flex items-center">
                        <Key size={14} className="mr-1" />
                        {config.auth_type.toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Timeout</p>
                      <p className="text-sm font-medium text-slate-900">{config.timeout}ms</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Reintentos</p>
                      <p className="text-sm font-medium text-slate-900">{config.retry_attempts}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleEdit(config)}
                  className="ml-4 text-teal-600 hover:text-teal-700 transition"
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>
          ))}

          {configs.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
              <Shield size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600">No hay configuraciones de API externa</p>
              <p className="text-sm text-slate-500 mt-1">Cree una nueva configuración para comenzar</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Fecha/Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Resultado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Ref. Externa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Duración
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Reintentos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {new Date(log.created_at).toLocaleString('es-UY')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        log.config?.config_type === 'pdf_generation'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {log.config?.config_type === 'pdf_generation' ? 'PDF' : 'DGI'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getValidationResultColor(log.validation_result)}`}>
                        {log.validation_result}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {log.external_reference || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {log.duration_ms}ms
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {log.retry_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          setSelectedLog(log);
                          setShowLogModal(true);
                        }}
                        className="text-teal-600 hover:text-teal-700"
                      >
                        Ver detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600">No hay registros de validación</p>
            </div>
          )}

          {totalLogs > logsPerPage && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Mostrando {((currentPage - 1) * logsPerPage) + 1} a {Math.min(currentPage * logsPerPage, totalLogs)} de {totalLogs} registros
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.ceil(totalLogs / logsPerPage) }, (_, i) => i + 1)
                    .filter(page => {
                      const totalPages = Math.ceil(totalLogs / logsPerPage);
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return true;
                      if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                      if (page === currentPage - 2 || page === currentPage + 2) return '...';
                      return false;
                    })
                    .map((page, idx, arr) => {
                      if (page === '...' && arr[idx - 1] !== '...') {
                        return (
                          <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                            ...
                          </span>
                        );
                      }
                      if (page === '...') return null;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page as number)}
                          className={`px-3 py-1 border rounded-lg text-sm font-medium transition ${
                            currentPage === page
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalLogs / logsPerPage), prev + 1))}
                  disabled={currentPage === Math.ceil(totalLogs / logsPerPage)}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedConfig ? 'Editar Configuración' : 'Nueva Configuración'}
                </h2>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre de la Configuración
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    URL de API
                  </label>
                  <input
                    type="url"
                    value={formData.api_url}
                    onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2"
                    placeholder="https://api.example.com/validate"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de Configuración
                  </label>
                  <select
                    value={formData.config_type}
                    onChange={(e) => setFormData({ ...formData, config_type: e.target.value as any })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2"
                  >
                    <option value="validation">Validación DGI</option>
                    <option value="pdf_generation">Generación de PDF</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de Autenticación
                  </label>
                  <select
                    value={formData.auth_type}
                    onChange={(e) => setFormData({ ...formData, auth_type: e.target.value as any, auth_credentials: {} })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2"
                  >
                    <option value="none">Sin Autenticación</option>
                    <option value="basic">Basic Auth</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Estado
                  </label>
                  <select
                    value={formData.is_active ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2"
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </div>

                {formData.auth_type === 'basic' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Usuario
                      </label>
                      <input
                        type="text"
                        value={formData.auth_credentials?.username || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          auth_credentials: { ...formData.auth_credentials, username: e.target.value }
                        })}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.auth_credentials?.password || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            auth_credentials: { ...formData.auth_credentials, password: e.target.value }
                          })}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {formData.auth_type === 'bearer' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Bearer Token
                    </label>
                    <input
                      type="text"
                      value={formData.auth_credentials?.token || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        auth_credentials: { token: e.target.value }
                      })}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2"
                    />
                  </div>
                )}

                {formData.auth_type === 'api_key' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Nombre del Header
                      </label>
                      <input
                        type="text"
                        value={formData.auth_credentials?.key || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          auth_credentials: { ...formData.auth_credentials, key: e.target.value }
                        })}
                        placeholder="X-API-Key"
                        className="w-full border border-slate-300 rounded-lg px-4 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Valor del API Key
                      </label>
                      <input
                        type="text"
                        value={formData.auth_credentials?.value || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          auth_credentials: { ...formData.auth_credentials, value: e.target.value }
                        })}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={formData.timeout}
                    onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2"
                    min="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Reintentos
                  </label>
                  <input
                    type="number"
                    value={formData.retry_attempts}
                    onChange={(e) => setFormData({ ...formData, retry_attempts: parseInt(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2"
                    min="0"
                    max="10"
                  />
                </div>

                <div className="col-span-2 border-t border-slate-200 pt-6">
                  <h3 className="text-base font-semibold text-slate-900 mb-4">Configuración de Request y Response</h3>
                </div>

                {formData.config_type === 'validation' ? (
                  <div className="col-span-2 bg-blue-50 rounded-lg p-6 border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center space-x-2">
                      <FileText size={16} />
                      <span>Formato Request - Validación DGI (e-Ticket)</span>
                    </h3>
                    <p className="text-xs text-blue-800 mb-3">
                      El formato de envío está configurado automáticamente para e-Tickets (ventas al público).
                    </p>
                    <div className="bg-white rounded p-3 text-xs font-mono text-slate-700 overflow-x-auto">
                      <pre className="whitespace-pre-wrap">{`{
  "numero_cfe": "[Número de factura]",
  "serie": "A",
  "rut_emisor": "[RUT emisor]",
  "razon_social_emisor": "[Razón social]",
  "fecha_emision": "[Fecha ISO]",
  "moneda": "UYU",
  "total": [Total],
  "subtotal": [Subtotal],
  "iva": [IVA],
  "items": [...],
  "datos_adicionales": {
    "observaciones": "Venta al público",
    "forma_pago": "Contado"
  }
}`}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="col-span-2 bg-purple-50 rounded-lg p-6 border border-purple-200">
                    <h3 className="text-sm font-semibold text-purple-900 mb-2 flex items-center space-x-2">
                      <FileText size={16} />
                      <span>Formato Request - Generación de PDF</span>
                    </h3>
                    <p className="text-xs text-purple-800 mb-3">
                      El formato de envío está configurado automáticamente para generar PDFs con los datos de DGI.
                    </p>
                    <div className="bg-white rounded p-3 text-xs font-mono text-slate-700 overflow-x-auto max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">{`{
  "order_id": "ORDER-80000",
  "pdf_template_name": "invoice_email_service",
  "recipient_email": "cliente@ejemplo.com",
  "data": {
    "response_payload": {
      "success": true,
      "approved": true,
      "reference": "CFE-123456789",
      "numero_cfe": "101000001",
      "serie_cfe": "A",
      "tipo_cfe": "101",
      "cae": "12345678901234",
      "vencimiento_cae": "2025-10-29",
      "qr_code": "https://servicios.dgi.gub.uy/cfe?id=...",
      "dgi_estado": "aprobado",
      "dgi_codigo_autorizacion": "AUTH12345",
      "dgi_mensaje": "Comprobante aprobado correctamente",
      "dgi_id_efactura": "EF-987654321",
      "dgi_fecha_validacion": "2025-10-22T14:35:22Z"
    },
    "issuer": {
      "numero_cfe": "INV-1729567890",
      "serie": "A",
      "rut": "211234560018",
      "razon_social": "Empresa Demo S.A.",
      "fecha_emision": "2025-10-22",
      "moneda": "UYU",
      "subtotal": 819.67,
      "iva": 180.33,
      "total": 1000.00
    },
    "items": [
      {
        "descripcion": "Producto o Servicio",
        "cantidad": 2,
        "precio_unitario": 409.84,
        "iva_porcentaje": 22,
        "subtotal": 819.68,
        "iva": 180.33,
        "total": 1000.00
      }
    ],
    "datos_adicionales": {
      "observaciones": "Venta al público",
      "forma_pago": "Efectivo"
    }
  },
  "pending_fields": ["invoice_pdf", "invoice_number"],
  "external_reference_id": "INVOICE-12345",
  "external_system": "billing_system",
  "webhook_url": "",
  "expires_at": "2025-10-25T23:59:59Z"
}`}</pre>
                    </div>
                  </div>
                )}

                {formData.config_type === 'validation' ? (
                  <div className="col-span-2 bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <FieldMapper
                      title="Mapeo de Response (Captura de Respuesta DGI)"
                      mappings={formData.response_mapping || {}}
                      onChange={(mappings) => setFormData({ ...formData, response_mapping: mappings })}
                      availableFields={RESPONSE_AVAILABLE_FIELDS}
                      placeholder="Seleccione campo a guardar"
                      isResponse={true}
                    />
                    <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Ejemplo de Response DGI</h4>
                      <div className="bg-white rounded p-3 text-xs font-mono text-slate-700 overflow-x-auto">
                        <pre className="whitespace-pre-wrap">{`{
  "success": true,
  "approved": true,
  "reference": "CFE-123456789",
  "numero_cfe": "101000001",
  "serie_cfe": "A",
  "tipo_cfe": "101",
  "cae": "12345678901234",
  "vencimiento_cae": "2025-10-29",
  "qr_code": "https://servicios.dgi.gub.uy/cfe?id=abc123...",
  "dgi_estado": "aprobado",
  "dgi_codigo_autorizacion": "AUTH12345",
  "dgi_mensaje": "Comprobante aprobado correctamente",
  "dgi_id_efactura": "EF-987654321",
  "dgi_fecha_validacion": "2025-10-22T14:35:22Z"
}`}</pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="col-span-2 bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-900 mb-2">Response de Generación de PDF</h3>
                      <p className="text-xs text-slate-600 mb-3">
                        El sistema solo valida que <code className="bg-slate-200 px-1 py-0.5 rounded">success: true</code> en la respuesta.
                        El PDF se genera y envía desde el sistema externo, no necesitas guardarlo aquí.
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <h4 className="text-sm font-semibold text-purple-900 mb-2">Ejemplo de Response - Generación de PDF</h4>
                      <div className="bg-white rounded p-3 text-xs font-mono text-slate-700 overflow-x-auto">
                        <pre className="whitespace-pre-wrap">{`{
  "success": true,
  "message": "PDF generated successfully",
  "data": {
    "pdf_id": "920f780c-5436-47e4-9047-562d904f4027",
    "pdf_base64": "JVBERi0xLjQKJeL.......",
    "filename": "Factura_.pdf",
    "size_bytes": 1746964
  }
}`}</pre>
                      </div>
                      <div className="mt-3 p-3 bg-purple-100 rounded text-xs text-purple-800">
                        <strong>Nota:</strong> Solo se verifica que <code className="bg-purple-200 px-1 py-0.5 rounded">success === true</code>.
                        El PDF no se guarda en este sistema, el envío por email lo gestiona el sistema externo.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {selectedConfig && (
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Probar Configuración</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    {selectedConfig.config_type === 'pdf_generation'
                      ? 'Selecciona una factura aprobada para probar el envío de PDF'
                      : 'Selecciona una factura existente para probar la validación con DGI'}
                  </p>
                  <div className="flex space-x-2">
                    <select
                      value={testInvoiceId}
                      onChange={(e) => setTestInvoiceId(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-4 py-2 bg-white"
                    >
                      <option value="">Seleccionar factura...</option>
                      {invoices.map((invoice) => (
                        <option key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {invoice.clients?.company_name || invoice.clients?.contact_name}
                          {invoice.numero_cfe && ` (CFE: ${invoice.numero_cfe})`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={testing || !testInvoiceId}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <TestTube size={18} />
                      <span>{testing ? 'Probando...' : 'Probar'}</span>
                    </button>
                  </div>
                  {testInvoiceId && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-slate-400">
                        ℹ️ {selectedConfig.config_type === 'pdf_generation'
                          ? 'La factura seleccionada será enviada a la API de generación de PDF'
                          : 'La factura seleccionada será validada con la API de DGI configurada'}
                      </p>
                      <p className="text-xs text-green-600 font-medium">
                        🖥️ El JSON enviado y recibido se mostrará en la consola del navegador (F12)
                      </p>
                    </div>
                  )}

                  <div className={`mt-4 p-4 rounded-lg border ${
                    selectedConfig.config_type === 'pdf_generation'
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <h4 className={`text-sm font-semibold mb-2 ${
                      selectedConfig.config_type === 'pdf_generation' ? 'text-purple-900' : 'text-blue-900'
                    }`}>
                      💡 Solución de Problemas
                    </h4>
                    <ul className={`text-xs space-y-1 ${
                      selectedConfig.config_type === 'pdf_generation' ? 'text-purple-800' : 'text-blue-800'
                    }`}>
                      <li><strong>HTTP 500:</strong> La API externa tiene problemas internos. Verifica la URL y contacta soporte.</li>
                      <li><strong>HTTP 401/403:</strong> Error de autenticación. Verifica las credenciales en la configuración.</li>
                      <li><strong>HTTP 400:</strong> Request inválido. Verifica que los datos enviados sean correctos.</li>
                      <li><strong>HTTP 404:</strong> URL incorrecta. Verifica que la URL de la API sea la correcta.</li>
                      <li><strong>Timeout:</strong> La API no responde a tiempo. Aumenta el timeout en configuración.</li>
                    </ul>
                    <p className={`text-xs mt-3 pt-2 border-t ${
                      selectedConfig.config_type === 'pdf_generation'
                        ? 'text-purple-700 border-purple-200'
                        : 'text-blue-700 border-blue-200'
                    }`}>
                      📋 <strong>Tip:</strong> Abre la pestaña "Logs" para ver el request enviado y la response recibida.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 transition flex items-center space-x-2"
                >
                  <Save size={18} />
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Detalles de Validación</h2>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Estado</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedLog.status)}`}>
                    {selectedLog.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Resultado</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getValidationResultColor(selectedLog.validation_result)}`}>
                    {selectedLog.validation_result}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Duración</p>
                  <p className="text-sm font-medium text-slate-900">{selectedLog.duration_ms}ms</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Reintentos</p>
                  <p className="text-sm font-medium text-slate-900">{selectedLog.retry_count}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Código HTTP</p>
                  <p className="text-sm font-medium text-slate-900">{selectedLog.status_code || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Referencia Externa</p>
                  <p className="text-sm font-medium text-slate-900">{selectedLog.external_reference || 'N/A'}</p>
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Mensaje de Error</p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Request Payload</p>
                <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.request_payload, null, 2)}
                </pre>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Response Payload</p>
                <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.response_payload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
