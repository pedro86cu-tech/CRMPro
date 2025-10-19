import React, { useState, useEffect } from 'react';
import {
  Settings, Plus, Edit2, Trash2, Check, X, DollarSign,
  ShoppingCart, CreditCard, FileText, Package
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Parameter {
  id: string;
  code: string;
  name: string;
  color?: string;
  symbol?: string;
  iso_code?: string;
  sort_order?: number;
  is_active: boolean;
  is_default?: boolean;
}

type ParameterType = 'currencies' | 'order_statuses' | 'payment_statuses' | 'item_types' | 'payment_methods' | 'invoice_statuses';

const ParametersModule: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ParameterType>('currencies');
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Parameter>>({
    code: '',
    name: '',
    color: '#64748b',
    symbol: '',
    iso_code: '',
    is_active: true,
    is_default: false,
    sort_order: 0
  });

  const tabs = [
    { id: 'currencies' as ParameterType, label: 'Monedas', icon: DollarSign },
    { id: 'order_statuses' as ParameterType, label: 'Estados de Orden', icon: ShoppingCart },
    { id: 'payment_statuses' as ParameterType, label: 'Estados de Pago', icon: CreditCard },
    { id: 'item_types' as ParameterType, label: 'Tipos de Item', icon: Package },
    { id: 'payment_methods' as ParameterType, label: 'Métodos de Pago', icon: CreditCard },
    { id: 'invoice_statuses' as ParameterType, label: 'Estados de Factura', icon: FileText }
  ];

  useEffect(() => {
    loadParameters();
  }, [activeTab]);

  const loadParameters = async () => {
    setLoading(true);
    try {
      const hasSortOrder = ['order_statuses', 'payment_statuses', 'invoice_statuses'].includes(activeTab);
      const orderBy = hasSortOrder ? 'sort_order' : 'code';

      const { data, error } = await supabase
        .from(activeTab)
        .select('*')
        .order(orderBy, { ascending: true });

      if (error) throw error;
      setParameters(data || []);
    } catch (error: any) {
      toast.error('Error al cargar parámetros: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }

    try {
      const hasColor = ['order_statuses', 'payment_statuses', 'invoice_statuses'].includes(activeTab);
      const hasSymbol = activeTab === 'currencies';
      const hasSortOrder = ['order_statuses', 'payment_statuses', 'invoice_statuses'].includes(activeTab);
      const hasDefault = activeTab === 'currencies';

      const dataToSave: any = {
        code: formData.code,
        name: formData.name,
        is_active: formData.is_active ?? true
      };

      if (hasColor) {
        dataToSave.color = formData.color || '#64748b';
      }

      if (hasSymbol) {
        if (formData.symbol) dataToSave.symbol = formData.symbol;
        if (formData.iso_code) dataToSave.iso_code = formData.iso_code;
      }

      if (hasSortOrder) {
        dataToSave.sort_order = formData.sort_order ?? 0;
      }

      if (hasDefault) {
        dataToSave.is_default = formData.is_default ?? false;
      }

      console.log('[PARAMETERS] Saving data:', { activeTab, editingId, dataToSave });

      if (editingId) {
        dataToSave.updated_at = new Date().toISOString();
        const response = await supabase
          .from(activeTab)
          .update(dataToSave)
          .eq('id', editingId);

        console.log('[PARAMETERS] Update response:', response);

        if (response.error) throw response.error;
        toast.success('Parámetro actualizado correctamente');
      } else {
        const response = await supabase
          .from(activeTab)
          .insert([dataToSave]);

        console.log('[PARAMETERS] Insert response:', response);

        if (response.error) throw response.error;
        toast.success('Parámetro creado correctamente');
      }

      resetForm();
      loadParameters();
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Error desconocido';
      console.error('[PARAMETERS] Error saving:', error);
      toast.error('Error al guardar: ' + errorMessage);
    }
  };

  const handleEdit = (param: Parameter) => {
    setFormData({
      ...param,
      color: param.color || '#64748b',
      symbol: param.symbol || '',
      iso_code: param.iso_code || '',
      sort_order: param.sort_order ?? 0,
      is_active: param.is_active ?? true,
      is_default: param.is_default ?? false
    });
    setEditingId(param.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este parámetro?')) return;

    try {
      const { error } = await supabase
        .from(activeTab)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Parámetro eliminado correctamente');
      loadParameters();
    } catch (error: any) {
      toast.error('Error al eliminar: ' + error.message);
    }
  };

  const handleToggleActive = async (param: Parameter) => {
    try {
      const { error } = await supabase
        .from(activeTab)
        .update({ is_active: !param.is_active })
        .eq('id', param.id);

      if (error) throw error;
      toast.success('Estado actualizado correctamente');
      loadParameters();
    } catch (error: any) {
      toast.error('Error al actualizar estado: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      color: '#64748b',
      symbol: '',
      iso_code: '',
      is_active: true,
      is_default: false,
      sort_order: 0
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const renderFormFields = () => {
    const hasColor = ['order_statuses', 'payment_statuses', 'invoice_statuses'].includes(activeTab);
    const hasSymbol = activeTab === 'currencies';
    const hasSortOrder = ['order_statuses', 'payment_statuses', 'invoice_statuses'].includes(activeTab);
    const hasDefault = activeTab === 'currencies';

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Código <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.code || ''}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="ej: UYU, pending"
            disabled={!!editingId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="ej: Peso Uruguayo"
          />
        </div>

        {hasSymbol && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Símbolo
              </label>
              <input
                type="text"
                value={formData.symbol || ''}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="ej: $, US$"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Código ISO (DGI)
              </label>
              <input
                type="text"
                value={formData.iso_code || ''}
                onChange={(e) => setFormData({ ...formData, iso_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="ej: 858, 840"
              />
            </div>
          </>
        )}

        {hasColor && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Color
            </label>
            <input
              type="color"
              value={formData.color || '#64748b'}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full h-10 px-1 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        )}

        {hasSortOrder && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Orden
            </label>
            <input
              type="number"
              value={formData.sort_order || 0}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        )}

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.is_active || false}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700">Activo</span>
          </label>

          {hasDefault && (
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_default || false}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Por Defecto</span>
            </label>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="w-8 h-8 text-emerald-600" />
          <h2 className="text-2xl font-bold text-slate-800">Parámetros del Sistema</h2>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    resetForm();
                  }}
                  className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-800">
              {tabs.find(t => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showAddForm ? 'Cancelar' : 'Agregar'}</span>
            </button>
          </div>

          {showAddForm && (
            <div className="bg-slate-50 rounded-lg p-6 mb-6 border border-slate-200">
              <h4 className="text-md font-semibold text-slate-800 mb-4">
                {editingId ? 'Editar Parámetro' : 'Nuevo Parámetro'}
              </h4>
              {renderFormFields()}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar</span>
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Nombre</th>
                    {activeTab === 'currencies' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Símbolo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ISO (DGI)</th>
                      </>
                    )}
                    {['order_statuses', 'payment_statuses', 'invoice_statuses'].includes(activeTab) && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Color</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Orden</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {parameters.map((param) => (
                    <tr key={param.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900 font-mono">{param.code}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{param.name}</td>
                      {activeTab === 'currencies' && (
                        <>
                          <td className="px-4 py-3 text-sm text-slate-900">{param.symbol}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 font-mono">{param.iso_code}</td>
                        </>
                      )}
                      {['order_statuses', 'payment_statuses', 'invoice_statuses'].includes(activeTab) && (
                        <>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded border border-slate-200"
                                style={{ backgroundColor: param.color }}
                              />
                              <span className="text-xs text-slate-600">{param.color}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-slate-900">{param.sort_order}</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(param)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            param.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {param.is_active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleEdit(param)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(param.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {parameters.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No hay parámetros configurados
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParametersModule;
