import { supabase } from './supabase';
import { externalAuth } from './externalAuth';

interface TwilioConfig {
  account_sid: string;
  auth_token: string;
  phone_number: string;
  is_test_mode: boolean;
}

interface CallParams {
  to: string;
  from?: string;
  url?: string;
  statusCallback?: string;
  record?: boolean;
}

export class TwilioService {
  private config: TwilioConfig | null = null;

  async loadConfig(forceReload: boolean = false): Promise<boolean> {
    // Si se fuerza la recarga o no hay config, cargar desde DB
    if (forceReload || !this.config) {
      try {
        const { data, error } = await supabase
          .from('twilio_config')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();

        if (error || !data) {
          return false;
        }

        this.config = data;
        return true;
      } catch (error) {
        return false;
      }
    }
    return true;
  }

  clearConfig(): void {
    this.config = null;
  }

  async initiateCall(params: CallParams): Promise<{ success: boolean; callSid?: string; error?: string }> {
    // Siempre recargar la configuración para obtener las credenciales más recientes
    const loaded = await this.loadConfig(true);
    if (!loaded) {
      return { success: false, error: 'Twilio no está configurado. Por favor configura Twilio en Ajustes.' };
    }

    if (!this.config) {
      return { success: false, error: 'No se pudo cargar la configuración de Twilio' };
    }

    // Validar que tenemos las credenciales necesarias
    if (!this.config.account_sid || !this.config.auth_token) {
      return { success: false, error: 'Credenciales de Twilio incompletas. Verifica Account SID y Auth Token en Ajustes.' };
    }

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.account_sid}/Calls.json`;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const twilioWebhookUrl = `${supabaseUrl}/functions/v1/twilio-voice-webhook`;


      const formData = new URLSearchParams({
        To: params.to,
        From: params.from || this.config.phone_number,
        Url: params.url || twilioWebhookUrl,
        StatusCallback: params.statusCallback || '',
        Record: params.record ? 'true' : 'false',
      });

      const authString = btoa(`${this.config.account_sid}:${this.config.auth_token}`);

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();

        let errorMessage = errorData.message || 'Error al iniciar la llamada';

        // Error de autenticación
        if (response.status === 401 || errorMessage.toLowerCase().includes('authenticate')) {
          errorMessage = 'Credenciales de Twilio inválidas. Por favor verifica tu Account SID y Auth Token en Ajustes.';
        }
        // Permisos geográficos
        else if (errorMessage.includes('geo-permissions') || errorMessage.includes('not authorized to call')) {
          errorMessage = `Permisos internacionales no habilitados. Por favor habilita llamadas a este país en: https://www.twilio.com/console/voice/calls/geo-permissions`;
        }
        // Formato de número
        else if (errorData.code === 21210) {
          errorMessage = 'El número de teléfono de destino no está en formato E.164 válido';
        }
        // Número de origen
        else if (errorData.code === 21606) {
          errorMessage = 'El número de teléfono de origen no es válido o no pertenece a tu cuenta';
        }
        // Account no válido
        else if (errorData.code === 20003) {
          errorMessage = 'El Account SID no es válido. Verifica tu configuración en Ajustes.';
        }

        return {
          success: false,
          error: errorMessage
        };
      }

      const data = await response.json();

      await this.logCall({
        call_sid: data.sid,
        from_number: data.from,
        to_number: data.to,
        direction: 'outbound',
        status: data.status,
      });

      return {
        success: true,
        callSid: data.sid
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error desconocido al iniciar la llamada'
      };
    }
  }

  async logCall(callData: {
    call_sid: string;
    call_id?: string;
    from_number: string;
    to_number: string;
    direction: string;
    status: string;
    duration?: number;
    recording_url?: string;
    recording_sid?: string;
    error_code?: string;
    error_message?: string;
    price?: string;
    price_unit?: string;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('twilio_call_logs')
        .insert(callData);

      if (error) {
      }
    } catch (error) {
    }
  }

  async updateCallLog(callSid: string, updateData: {
    status?: string;
    duration?: number;
    recording_url?: string;
    recording_sid?: string;
    error_code?: string;
    error_message?: string;
    price?: string;
    price_unit?: string;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('twilio_call_logs')
        .update(updateData)
        .eq('call_sid', callSid);

      if (error) {
      }
    } catch (error) {
    }
  }

  async getCallStatus(callSid: string): Promise<any> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      return null;
    }

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.account_sid}/Calls/${callSid}.json`;
      const authString = btoa(`${this.config.account_sid}:${this.config.auth_token}`);

      const response = await fetch(twilioUrl, {
        headers: {
          'Authorization': `Basic ${authString}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      return null;
    }
  }

  async getCallRecordings(callSid: string): Promise<any[]> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      return [];
    }

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.account_sid}/Calls/${callSid}/Recordings.json`;
      const authString = btoa(`${this.config.account_sid}:${this.config.auth_token}`);

      const response = await fetch(twilioUrl, {
        headers: {
          'Authorization': `Basic ${authString}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.recordings || [];
    } catch (error) {
      return [];
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getConfig(): TwilioConfig | null {
    return this.config;
  }

  async connectIncomingCall(callSid: string): Promise<{ success: boolean; error?: string }> {
    try {

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const externalToken = externalAuth.getStoredToken();
      const user = externalAuth.getStoredUser();

      if (!externalToken || !user) {
        return { success: false, error: 'No hay sesión activa' };
      }


      const response = await fetch(`${supabaseUrl}/functions/v1/twilio-connect-call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${externalToken}`,
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'x-user-id': user.id
        },
        body: JSON.stringify({ callSid, userId: user.id })
      });


      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Error al conectar la llamada' };
      }

      const result = await response.json();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error desconocido' };
    }
  }

  async getTwilioToken(): Promise<{ token: string; identity: string } | null> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const externalToken = externalAuth.getStoredToken();
      const user = externalAuth.getStoredUser();

      if (!externalToken || !user) {
        return null;
      }


      const response = await fetch(`${supabaseUrl}/functions/v1/twilio-access-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${externalToken}`,
          'apikey': anonKey,
          'x-user-id': user.id
        },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return null;
      }

      const tokenData = await response.json();

      return tokenData;
    } catch (error) {
      return null;
    }
  }
}

export const twilioService = new TwilioService();
