import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Settings, Plus, Save, X, Eye, EyeOff, TestTube,
  FileText, Shield, Key, Globe
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

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
  });

  useEffect(() => {
    fetchConfigs();
    fetchLogs();
  }, []);

  const fetchConfigs = async () => {
    const { data, error } = await supabase
      .from('external_invoice_api_config')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setConfigs(data);
    }
  };

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('external_invoice_validation_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data);
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

  const handleTest = async () => {
    if (!testInvoiceId) {
      toast.error('Por favor ingrese un ID de factura para probar');
      return;
    }

    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-invoice-external', {
        body: {
          invoice_id: testInvoiceId,
          config_id: selectedConfig?.id,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Validación exitosa: ${data.validation_result}`);
      } else {
        toast.error(`Error en validación: ${data.message}`);
      }

      fetchLogs();
    } catch (error: any) {
      toast.error('Error al probar validación: ' + error.message);
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
            Validación Externa de Facturas
          </h1>
          <p className="text-slate-600 mt-1">Configure la integración con sistemas externos de validación</p>
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

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Mapeo de Request (JSON)
                  </label>
                  <textarea
                    value={JSON.stringify(formData.request_mapping, null, 2)}
                    onChange={(e) => {
                      try {
                        setFormData({ ...formData, request_mapping: JSON.parse(e.target.value) });
                      } catch {}
                    }}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 font-mono text-sm"
                    rows={6}
                    placeholder='{"invoice_number": "invoice.invoice_number", "total": "invoice.total_amount"}'
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Formato: {`{"campo_destino": "ruta.origen.campo"}`}
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Mapeo de Response (JSON)
                  </label>
                  <textarea
                    value={JSON.stringify(formData.response_mapping, null, 2)}
                    onChange={(e) => {
                      try {
                        setFormData({ ...formData, response_mapping: JSON.parse(e.target.value) });
                      } catch {}
                    }}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 font-mono text-sm"
                    rows={4}
                    placeholder='{"approved": "response.approved", "reference": "response.id"}'
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Formato: {`{"campo_local": "ruta.response.campo"}`}
                  </p>
                </div>
              </div>

              {selectedConfig && (
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Probar Configuración</h3>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={testInvoiceId}
                      onChange={(e) => setTestInvoiceId(e.target.value)}
                      placeholder="ID de factura para probar"
                      className="flex-1 border border-slate-300 rounded-lg px-4 py-2"
                    />
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={testing}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2"
                    >
                      <TestTube size={18} />
                      <span>{testing ? 'Probando...' : 'Probar'}</span>
                    </button>
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
