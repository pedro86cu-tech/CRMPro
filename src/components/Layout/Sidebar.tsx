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
  DollarSign
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
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export function Sidebar({ activeModule, onModuleChange }: SidebarProps) {
  const { signOut } = useAuth();

  return (
    <div className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white h-screen flex flex-col shadow-2xl">
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
              onClick={() => onModuleChange(item.id)}
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

      <div className="p-4 border-t border-slate-700">
        <button
          onClick={signOut}
          className="w-full flex items-center space-x-3 px-4 py-3 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
}
