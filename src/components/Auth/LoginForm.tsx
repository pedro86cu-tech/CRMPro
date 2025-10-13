import { useAuth } from '../../contexts/AuthContext';
import { LogIn, Shield } from 'lucide-react';

export function LoginForm() {
  const { signIn } = useAuth();

  const handleLogin = () => {
    signIn();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl shadow-lg">
            <Shield className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2 text-slate-900">
          CRM Pro
        </h1>
        <p className="text-center text-slate-600 mb-8">
          Sistema de gestión empresarial
        </p>

         <button
          onClick={handleLogin}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-[1.02] shadow-lg flex items-center justify-center space-x-3"
        >
          <LogIn className="w-5 h-5" />
          <span>Iniciar Sesión</span>
        </button>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            Al iniciar sesión, serás redirigido al sistema de autenticación seguro
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-center space-x-4 text-sm text-slate-600">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Seguro</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Encriptado</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Confiable</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
