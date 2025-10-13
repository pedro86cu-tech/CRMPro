import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { externalAuth } from '../../lib/externalAuth';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

export function CallbackHandler() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Procesando autenticación...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const currentUrl = window.location.href;
      const callbackData = externalAuth.parseCallbackUrl(currentUrl);

      if (!callbackData) {
        setError('URL de callback inválida');
        return;
      }

      setStatus('Validando token...');

      if (externalAuth.isTokenExpired(callbackData.token)) {
        setError('El token ha expirado');
        return;
      }

      const user = externalAuth.getUserFromToken(callbackData.token);
      if (!user) {
        setError('No se pudo obtener información del usuario');
        return;
      }

      setStatus('Almacenando credenciales...');
      externalAuth.storeAuthData(
        callbackData.token,
        callbackData.refreshToken,
        callbackData.userId
      );

      setStatus('Sincronizando con base de datos...');
      const role = externalAuth.getUserRole();

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: user.name,
          role: role,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (profileError) {
      }

      setStatus('Autenticación exitosa, redirigiendo...');

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);

    } catch (err) {
      setError('Error procesando la autenticación');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Error de Autenticación</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Autenticando</h2>
        <p className="text-slate-600">{status}</p>
        <div className="mt-6 flex justify-center space-x-2">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-pink-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}
