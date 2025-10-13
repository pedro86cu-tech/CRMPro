import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Settings, Mail, Server, Globe, Shield, Save, CheckCircle, AlertCircle, Phone, TestTube
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { twilioService } from '../../lib/twilioService';

export function SettingsModule() {
  const toast = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'smtp' | 'email' | 'general' | 'twilio'>('smtp');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    from_email: '',
    from_name: ''
  });

  const [emailSettings, setEmailSettings] = useState({
    daily_limit: 1000,
    rate_limit: 50,
    retry_attempts: 3,
    bounce_handling: true
  });

  const [generalSettings, setGeneralSettings] = useState({
    company_name: '',
    company_website: '',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    date_format: 'DD/MM/YYYY'
  });

  const [twilioConfig, setTwilioConfig] = useState({
    id: '',
    account_sid: '',
    auth_token: '',
    phone_number: '',
    agent_number: '',
    twiml_app_sid: '',
    api_key_sid: '',
    api_key_secret: '',
    voice_url: '',
    status_callback_url: '',
    is_active: true,
    is_test_mode: false
  });

  useEffect(() => {
    loadSettings();
    loadTwilioConfig();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from('system_settings').select('*');

    if (data) {
      data.forEach((setting) => {
        if (setting.setting_key === 'smtp_config') {
          setSmtpConfig(setting.setting_value as any);
        } else if (setting.setting_key === 'email_settings') {
          setEmailSettings(setting.setting_value as any);
        } else if (setting.setting_key === 'general_settings') {
          setGeneralSettings(setting.setting_value as any);
        }
      });
    }
  };

  const loadTwilioConfig = async () => {
    const { data } = await supabase
      .from('twilio_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      setTwilioConfig(data);
    }
  };

  const saveSettings = async (key: string, value: any) => {
    setSaveStatus('saving');

    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: value,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', key);

      if (error) {
        setSaveStatus('error');
        toast.error(`Error al guardar: ${error.message}`);
      } else {
        setSaveStatus('success');
        toast.success('Configuración guardada correctamente');
        setTimeout(() => setSaveStatus('idle'), 2000);
        await loadSettings();
      }
    } catch (err) {
      setSaveStatus('error');
      toast.error('Error inesperado al guardar');
    }
  };

  const handleSaveSMTP = () => {
    saveSettings('smtp_config', smtpConfig);
  };

  const handleSaveEmail = () => {
    saveSettings('email_settings', emailSettings);
  };

  const handleSaveGeneral = () => {
    saveSettings('general_settings', generalSettings);
  };

  const handleTestTwilio = async () => {
    if (!twilioConfig.account_sid || !twilioConfig.auth_token) {
      toast.error('Por favor ingresa Account SID y Auth Token');
      return;
    }

    setSaveStatus('saving');
    toast.info('Probando conexión con Twilio...');

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.account_sid}.json`;
      const authString = btoa(`${twilioConfig.account_sid}:${twilioConfig.auth_token}`);

      const response = await fetch(twilioUrl, {
        headers: {
          'Authorization': `Basic ${authString}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSaveStatus('success');
        toast.success(`✅ Conexión exitosa! Cuenta: ${data.friendly_name || 'N/A'}`);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        const errorData = await response.json();
        setSaveStatus('error');
        toast.error(`❌ Error de autenticación: ${errorData.message || 'Credenciales inválidas'}`);
        setTimeout(() => setSaveStatus('idle'), 5000);
      }
    } catch (error: any) {
      setSaveStatus('error');
      toast.error(`Error al conectar: ${error.message}`);
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  };

  const handleSaveTwilio = async () => {
    setSaveStatus('saving');

    try {
      const twilioData = {
        account_sid: twilioConfig.account_sid,
        auth_token: twilioConfig.auth_token,
        phone_number: twilioConfig.phone_number,
        twiml_app_sid: twilioConfig.twiml_app_sid || null,
        api_key_sid: twilioConfig.api_key_sid || null,
        api_key_secret: twilioConfig.api_key_secret || null,
        voice_url: twilioConfig.voice_url || null,
        status_callback_url: twilioConfig.status_callback_url || null,
        is_active: twilioConfig.is_active,
        is_test_mode: twilioConfig.is_test_mode,
        created_by: user?.id,
        updated_by: user?.id
      };

      let error;

      if (twilioConfig.id) {
        ({ error } = await supabase
          .from('twilio_config')
          .update({ ...twilioData, updated_by: user?.id })
          .eq('id', twilioConfig.id));
      } else {
        ({ error } = await supabase
          .from('twilio_config')
          .insert(twilioData));
      }

      if (error) {
        setSaveStatus('error');
        toast.error(`Error al guardar: ${error.message}`);
      } else {
        // Limpiar caché del servicio de Twilio para forzar recarga
        twilioService.clearConfig();

        setSaveStatus('success');
        toast.success('Configuración de Twilio guardada correctamente');
        setTimeout(() => setSaveStatus('idle'), 2000);
        await loadTwilioConfig();
      }
    } catch (err) {
      setSaveStatus('error');
      toast.error('Error inesperado al guardar');
    }
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          Configuración del Sistema
        </h1>
        <p className="text-slate-600 mt-2 text-lg">Administra la configuración general del CRM</p>
      </div>

      {saveStatus !== 'idle' && (
        <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
          saveStatus === 'success' ? 'bg-green-50 border border-green-200' :
          saveStatus === 'error' ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          {saveStatus === 'success' ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-700 font-medium">Configuración guardada exitosamente</span>
            </>
          ) : saveStatus === 'error' ? (
            <>
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-700 font-medium">Error al guardar la configuración</span>
            </>
          ) : (
            <span className="text-blue-700 font-medium">Guardando...</span>
          )}
        </div>
      )}

      <div className="flex space-x-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('smtp')}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition ${
            activeTab === 'smtp'
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Server className="w-5 h-5" />
          <span>Servidor SMTP</span>
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition ${
            activeTab === 'email'
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Mail className="w-5 h-5" />
          <span>Email</span>
        </button>
        <button
          onClick={() => setActiveTab('twilio')}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition ${
            activeTab === 'twilio'
              ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Phone className="w-5 h-5" />
          <span>Twilio</span>
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition ${
            activeTab === 'general'
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span>General</span>
        </button>
      </div>

      {activeTab === 'smtp' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Server className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Configuración SMTP</h2>
              <p className="text-slate-600">Configura el servidor para envío de emails</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Host SMTP</label>
                <input
                  type="text"
                  value={smtpConfig.host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="smtp.gmail.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Puerto</label>
                <input
                  type="number"
                  value={smtpConfig.port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Usuario</label>
                <input
                  type="text"
                  value={smtpConfig.username}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="tu-email@gmail.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña</label>
                <input
                  type="password"
                  value={smtpConfig.password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email de Origen</label>
                <input
                  type="email"
                  value={smtpConfig.from_email}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="noreply@tuempresa.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre de Origen</label>
                <input
                  type="text"
                  value={smtpConfig.from_name}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Mi Empresa CRM"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="secure"
                checked={smtpConfig.secure}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="secure" className="text-sm text-slate-700">Usar conexión segura (SSL/TLS)</label>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSaveSMTP}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-600 transition shadow-lg"
              >
                <Save className="w-5 h-5" />
                <span>Guardar Configuración SMTP</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Mail className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Configuración de Email</h2>
              <p className="text-slate-600">Límites y políticas de envío</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Límite Diario</label>
                <input
                  type="number"
                  value={emailSettings.daily_limit}
                  onChange={(e) => setEmailSettings({ ...emailSettings, daily_limit: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">Número máximo de emails por día</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Límite por Hora</label>
                <input
                  type="number"
                  value={emailSettings.rate_limit}
                  onChange={(e) => setEmailSettings({ ...emailSettings, rate_limit: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">Emails por hora</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Intentos de Reenvío</label>
                <input
                  type="number"
                  value={emailSettings.retry_attempts}
                  onChange={(e) => setEmailSettings({ ...emailSettings, retry_attempts: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">Número de reintentos si falla</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="bounce"
                checked={emailSettings.bounce_handling}
                onChange={(e) => setEmailSettings({ ...emailSettings, bounce_handling: e.target.checked })}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="bounce" className="text-sm text-slate-700">Activar manejo de rebotes automático</label>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSaveEmail}
                className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-purple-600 transition shadow-lg"
              >
                <Save className="w-5 h-5" />
                <span>Guardar Configuración de Email</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-green-100 p-3 rounded-lg">
              <Globe className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Configuración General</h2>
              <p className="text-slate-600">Configuración de la empresa y sistema</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre de la Empresa</label>
                <input
                  type="text"
                  value={generalSettings.company_name}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Mi Empresa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sitio Web</label>
                <input
                  type="url"
                  value={generalSettings.company_website}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_website: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="https://ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Zona Horaria</label>
                <select
                  value={generalSettings.timezone}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                  <option value="America/Bogota">Bogotá (GMT-5)</option>
                  <option value="America/Lima">Lima (GMT-5)</option>
                  <option value="America/Santiago">Santiago (GMT-3)</option>
                  <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
                  <option value="Europe/Madrid">Madrid (GMT+1)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Moneda</label>
                <select
                  value={generalSettings.currency}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="USD">USD - Dólar Americano</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="COP">COP - Peso Colombiano</option>
                  <option value="ARS">ARS - Peso Argentino</option>
                  <option value="CLP">CLP - Peso Chileno</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Formato de Fecha</label>
                <select
                  value={generalSettings.date_format}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, date_format: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSaveGeneral}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-green-600 transition shadow-lg"
              >
                <Save className="w-5 h-5" />
                <span>Guardar Configuración General</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'twilio' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-lg">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Configuración de Twilio</h2>
              <p className="text-slate-600">Configura la integración con Twilio para realizar y recibir llamadas</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Información importante:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Obtén tus credenciales en <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">console.twilio.com</a></li>
                    <li>El Account SID comienza con "AC" seguido de 32 caracteres</li>
                    <li>El número de teléfono debe estar en formato E.164 (ej: +15551234567)</li>
                    <li>Los datos sensibles se almacenan de forma segura</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-orange-800">
                  <p className="font-semibold mb-1">Permisos Internacionales:</p>
                  <p className="text-orange-700 mb-2">
                    Para realizar llamadas internacionales, debes habilitar los permisos geográficos en tu cuenta de Twilio.
                  </p>
                  <a
                    href="https://www.twilio.com/console/voice/calls/geo-permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-orange-800 font-medium underline hover:text-orange-900"
                  >
                    Configurar permisos geográficos →
                  </a>
                  <p className="text-xs text-orange-600 mt-2">
                    Necesitarás habilitar los países a los que deseas llamar (ej: Uruguay, México, Argentina)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Credenciales Principales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Account SID *
                  </label>
                  <input
                    type="text"
                    value={twilioConfig.account_sid}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, account_sid: e.target.value })}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Identificador único de tu cuenta Twilio</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Auth Token *
                  </label>
                  <input
                    type="password"
                    value={twilioConfig.auth_token}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, auth_token: e.target.value })}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Token secreto para autenticación</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número de Teléfono Twilio *
                  </label>
                  <input
                    type="tel"
                    value={twilioConfig.phone_number}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, phone_number: e.target.value })}
                    placeholder="+15551234567"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">Número de Twilio para llamadas salientes</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número del Agente *
                  </label>
                  <input
                    type="tel"
                    value={twilioConfig.agent_number}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, agent_number: e.target.value })}
                    placeholder="+525512345678"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">Tu número donde recibirás las llamadas entrantes</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Configuración Avanzada (Opcional)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    TwiML Application SID
                  </label>
                  <input
                    type="text"
                    value={twilioConfig.twiml_app_sid}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, twiml_app_sid: e.target.value })}
                    placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Para funciones de voz programables avanzadas</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      API Key SID
                    </label>
                    <input
                      type="text"
                      value={twilioConfig.api_key_sid}
                      onChange={(e) => setTwilioConfig({ ...twilioConfig, api_key_sid: e.target.value })}
                      placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">Alternativa más segura al Auth Token</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      API Key Secret
                    </label>
                    <input
                      type="password"
                      value={twilioConfig.api_key_secret}
                      onChange={(e) => setTwilioConfig({ ...twilioConfig, api_key_secret: e.target.value })}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">Secreto de la API Key</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Voice URL
                  </label>
                  <input
                    type="url"
                    value={twilioConfig.voice_url}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, voice_url: e.target.value })}
                    placeholder="https://tu-dominio.com/voice"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">URL webhook para manejar llamadas entrantes</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status Callback URL
                  </label>
                  <input
                    type="url"
                    value={twilioConfig.status_callback_url}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, status_callback_url: e.target.value })}
                    placeholder="https://tu-dominio.com/status"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">URL para recibir actualizaciones de estado de llamadas</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Opciones</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={twilioConfig.is_active}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, is_active: e.target.checked })}
                    className="w-5 h-5 text-green-600 border-slate-300 rounded focus:ring-2 focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">Configuración Activa</span>
                    <p className="text-xs text-slate-500">Habilita esta configuración para usar Twilio</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={twilioConfig.is_test_mode}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, is_test_mode: e.target.checked })}
                    className="w-5 h-5 text-orange-600 border-slate-300 rounded focus:ring-2 focus:ring-orange-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">Modo de Prueba</span>
                    <p className="text-xs text-slate-500">Usa credenciales de prueba (no se realizarán llamadas reales)</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                onClick={handleTestTwilio}
                disabled={saveStatus === 'saving'}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TestTube className="w-5 h-5" />
                <span>Probar Conexión</span>
              </button>
              <button
                onClick={handleSaveTwilio}
                disabled={saveStatus === 'saving'}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-green-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                <span>Guardar Configuración</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
