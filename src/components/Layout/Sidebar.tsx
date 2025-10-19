import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Mail,
  ShoppingCart,
  FileText,
  Phone,
  Ticket,
  Inbox,
  Settings,
  LogOut,
  DollarSign,
  Menu,
  X,
  User
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'campaigns', label: 'Campañas', icon: Mail },
  { id: 'orders', label: 'Órdenes', icon: ShoppingCart },
  { id: 'invoices', label: 'Facturas', icon: FileText },
  { id: 'accounting', label: 'Contabilidad', icon: DollarSign },
  { id: 'calls', label: 'Llamadas', icon: Phone },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'inbox', label: 'Buzón', icon: Inbox },
  { id: 'parameters', label: 'Parámetros', icon: Settings },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export function Sidebar({ activeModule, onModuleChange }: SidebarProps) {
  const { signOut, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleModuleChange = (module: string) => {
    onModuleChange(module);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg shadow-lg"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white h-screen flex flex-col shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">CRM Pro</h1>
            <p className="text-xs text-slate-400">Sistema Integral</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleModuleChange(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700 space-y-3">
        {user && (
          <div className="px-4 py-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 bg-blue-600 rounded-full p-2">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={signOut}
          className="w-full flex items-center space-x-3 px-4 py-3 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </div>
    </>
  );
}
