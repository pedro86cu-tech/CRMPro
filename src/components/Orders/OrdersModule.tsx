import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Package, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle,
  DollarSign, Calendar, User, Building2, Search, Edit2, Eye, Trash2,
  X, ShoppingCart, FileText, Percent, Truck, CreditCard, MapPin
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  address: string;
  city: string;
  country: string;
}

interface OrderItem {
  id?: string;
  item_type: 'product' | 'service';
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
  notes: string;
}

interface Order {
  id: string;
  order_number: string;
  client_id: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  order_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  shipping_cost: number;
  total_amount: number;
  currency: string;
  notes: string;
  customer_notes: string;
  shipping_address: string;
  billing_address: string;
  payment_terms: string;
  payment_status: 'unpaid' | 'partial' | 'paid';
  created_at: string;
  clients?: Client;
  external_order_id?: string;
  external_partner_id?: string;
  payment_method?: string;
  metadata?: any;
}

export function OrdersModule() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    thisMonth: 0
  });
  const { user } = useAuth();
  const toast = useToast();

  const [formData, setFormData] = useState({
    order_date: new Date().toISOString().split('T')[0],
    due_date: '',
    tax_rate: 16,
    discount_amount: 0,
    shipping_cost: 0,
    currency: 'USD',
    notes: '',
    customer_notes: '',
    shipping_address: '',
    billing_address: '',
    payment_terms: 'Net 30',
    payment_status: 'unpaid' as const,
    status: 'pending' as const
  });

  const [newItem, setNewItem] = useState<OrderItem>({
    item_type: 'product',
    description: '',
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    line_total: 0,
    notes: ''
  });

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (clientSearch.length >= 2) {
      searchClients(clientSearch);
    } else {
      setFilteredClients([]);
      setShowClientDropdown(false);
    }
  }, [clientSearch]);

  useEffect(() => {
    calculateItemTotal();
  }, [newItem.quantity, newItem.unit_price, newItem.discount_percent]);

  useEffect(() => {
    if (selectedClient) {
      setFormData(prev => ({
        ...prev,
        shipping_address: `${selectedClient.address || ''}, ${selectedClient.city || ''}, ${selectedClient.country || ''}`.trim(),
        billing_address: `${selectedClient.address || ''}, ${selectedClient.city || ''}, ${selectedClient.country || ''}`.trim()
      }));
    }
  }, [selectedClient]);

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        clients (
          id,
          company_name,
          contact_name,
          email,
          address,
          city,
          country
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data);
      calculateStats(data);
    }
  };

  const calculateStats = (ordersData: Order[]) => {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalRevenue = ordersData
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    setStats({
      total: ordersData.length,
      pending: ordersData.filter(o => o.status === 'pending').length,
      confirmed: ordersData.filter(o => o.status === 'confirmed').length,
      in_progress: ordersData.filter(o => o.status === 'in_progress').length,
      completed: ordersData.filter(o => o.status === 'completed').length,
      cancelled: ordersData.filter(o => o.status === 'cancelled').length,
      totalRevenue,
      avgOrderValue: ordersData.filter(o => o.status === 'completed').length > 0
        ? totalRevenue / ordersData.filter(o => o.status === 'completed').length
        : 0,
      thisMonth: ordersData.filter(o => new Date(o.created_at) >= firstDayThisMonth).length
    });
  };

  const searchClients = async (term: string) => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .or(`company_name.ilike.%${term}%,contact_name.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(10);

    if (data) {
      setFilteredClients(data);
      setShowClientDropdown(true);
    }
  };

  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setClientSearch(client.company_name || client.contact_name);
    setShowClientDropdown(false);
  };

  const calculateItemTotal = () => {
    const subtotal = newItem.quantity * newItem.unit_price;
    const discount = subtotal * (newItem.discount_percent / 100);
    setNewItem(prev => ({ ...prev, line_total: subtotal - discount }));
  };

  const addItem = () => {
    if (!newItem.description || newItem.quantity <= 0 || newItem.unit_price <= 0) {
      toast.error('Por favor completa todos los campos del item');
      return;
    }

    setOrderItems([...orderItems, { ...newItem }]);
    setNewItem({
      item_type: 'product',
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      line_total: 0,
      notes: ''
    });
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateOrderTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.line_total, 0);
    const afterDiscount = subtotal - formData.discount_amount;
    const taxAmount = afterDiscount * (formData.tax_rate / 100);
    const total = afterDiscount + taxAmount + formData.shipping_cost;

    return { subtotal, taxAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient) {
      toast.error('Por favor selecciona un cliente');
      return;
    }

    if (orderItems.length === 0) {
      toast.error('Por favor agrega al menos un item a la orden');
      return;
    }

    try {
      const { subtotal, taxAmount, total } = calculateOrderTotals();

      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

      const orderData = {
        order_number: orderNumber,
        client_id: selectedClient.id,
        ...formData,
        subtotal,
        tax_amount: taxAmount,
        total_amount: total,
        created_by: user?.id
      };

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        toast.error(`Error al crear orden: ${orderError.message}`);
        return;
      }

      const itemsToInsert = orderItems.map(item => ({
        order_id: newOrder.id,
        ...item
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        toast.error(`Error al crear items: ${itemsError.message}`);
        return;
      }

      toast.success('Orden creada correctamente');
      loadOrders();
      resetForm();
    } catch (err) {
      toast.error('Error inesperado al guardar la orden');
    }
  };

  const resetForm = () => {
    setFormData({
      order_date: new Date().toISOString().split('T')[0],
      due_date: '',
      tax_rate: 16,
      discount_amount: 0,
      shipping_cost: 0,
      currency: 'USD',
      notes: '',
      customer_notes: '',
      shipping_address: '',
      billing_address: '',
      payment_terms: 'Net 30',
      payment_status: 'unpaid',
      status: 'pending'
    });
    setClientSearch('');
    setSelectedClient(null);
    setOrderItems([]);
    setNewItem({
      item_type: 'product',
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      line_total: 0,
      notes: ''
    });
    setShowModal(false);
  };

  const updateStatus = async (orderId: string, newStatus: Order['status']) => {
    const updateData: any = { status: newStatus, updated_by: user?.id };

    if (newStatus === 'completed') {
      updateData.payment_status = 'paid';
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      toast.error('Error al actualizar estado');
      return;
    }

    loadOrders();

    if (newStatus === 'completed') {
      toast.success('Estado actualizado y pago marcado como completado');
    } else {
      toast.success('Estado actualizado correctamente');
    }

    if (selectedOrder?.id === orderId) {
      const updatedOrder = { ...selectedOrder, status: newStatus };
      if (newStatus === 'completed') {
        updatedOrder.payment_status = 'paid';
      }
      setSelectedOrder(updatedOrder);
    }
  };

  const viewOrderDetails = async (order: Order) => {
    setSelectedOrder(order);

    const { data: items, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (error) {
      toast.error('Error al cargar detalles de la orden');
      return;
    }

    setSelectedOrderItems(items || []);
    setShowViewModal(true);
  };

  const generatePaymentLink = async (order: Order) => {
    try {
      const paymentData = {
        order_id: order.id,
        order_number: order.order_number,
        amount: order.total_amount,
        currency: order.currency,
        customer_email: order.clients?.email,
        customer_name: order.clients?.contact_name,
        description: `Pago para orden ${order.order_number}`
      };

      const paymentLink = `${window.location.origin}/payment/${order.id}?token=${btoa(JSON.stringify(paymentData))}`;

      await navigator.clipboard.writeText(paymentLink);
      toast.success('Link de pago copiado al portapapeles');
    } catch (error) {
      toast.error('Error al generar link de pago');
    }
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.clients?.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.clients?.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'in_progress': return <Package className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'confirmed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmada';
      case 'in_progress': return 'En Progreso';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const { subtotal, taxAmount, total } = calculateOrderTotals();

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          Gestión de Órdenes
        </h1>
        <p className="text-slate-600 mt-2 text-lg">Administra todas tus órdenes de compra</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Package className="w-8 h-8" />
            </div>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-blue-100 text-sm font-medium">Total Órdenes</p>
            <p className="text-4xl font-bold">{stats.total}</p>
            <p className="text-blue-100 text-xs">{stats.thisMonth} este mes</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <DollarSign className="w-8 h-8" />
            </div>
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-emerald-100 text-sm font-medium">Ingresos Totales</p>
            <p className="text-4xl font-bold">${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            <p className="text-emerald-100 text-xs">{stats.completed} completadas</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Clock className="w-8 h-8" />
            </div>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-amber-100 text-sm font-medium">Pendientes</p>
            <p className="text-4xl font-bold">{stats.pending}</p>
            <p className="text-amber-100 text-xs">{stats.in_progress} en progreso</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <TrendingUp className="w-8 h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-violet-100 text-sm font-medium">Valor Promedio</p>
            <p className="text-4xl font-bold">${Math.round(stats.avgOrderValue).toLocaleString()}</p>
            <p className="text-violet-100 text-xs">por orden</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Pendientes</p>
              <p className="text-3xl font-bold text-slate-900">{stats.pending}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Confirmadas</p>
              <p className="text-3xl font-bold text-slate-900">{stats.confirmed}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">En Progreso</p>
              <p className="text-3xl font-bold text-slate-900">{stats.in_progress}</p>
            </div>
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Completadas</p>
              <p className="text-3xl font-bold text-slate-900">{stats.completed}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Canceladas</p>
              <p className="text-3xl font-bold text-slate-900">{stats.cancelled}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar órdenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition shadow-lg ml-4"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Nueva Orden</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Número</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Cliente</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Fecha</th>
                <th className="text-right py-4 px-4 text-sm font-semibold text-slate-700">Total</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Estado</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Pago</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      <div className="bg-emerald-100 p-2 rounded-lg">
                        <Package className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{order.order_number}</span>
                        {order.external_order_id && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full w-fit mt-1">
                            DogCatify
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-start flex-col">
                      <div className="flex items-center space-x-2">
                        {order.clients?.company_name ? (
                          <Building2 className="w-4 h-4 text-slate-400" />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="text-slate-900 font-medium">
                          {order.clients?.company_name || order.clients?.contact_name || 'N/A'}
                        </span>
                      </div>
                      {order.clients?.company_name && (
                        <span className="text-xs text-slate-500 ml-6">{order.clients.contact_name}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(order.order_date).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-lg font-bold text-emerald-600">
                      ${order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className="text-xs text-slate-500">{order.currency}</div>
                  </td>
                  <td className="py-4 px-4">
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value as any)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border cursor-pointer transition ${getStatusColor(order.status)}`}
                    >
                      <option value="pending">Pendiente</option>
                      <option value="confirmed">Confirmada</option>
                      <option value="in_progress">En Progreso</option>
                      <option value="completed">Completada</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      order.payment_status === 'paid'
                        ? 'bg-emerald-100 text-emerald-700'
                        : order.payment_status === 'partial'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {order.payment_status === 'paid' ? 'Pagado' : order.payment_status === 'partial' ? 'Parcial' : 'Sin pagar'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => viewOrderDetails(order)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Ver detalles"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => generatePaymentLink(order)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Generar link de pago"
                      >
                        <CreditCard className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Nueva Orden de Compra</h2>
                  <p className="text-emerald-100 text-sm mt-1">Completa los datos de la orden</p>
                </div>
                <button
                  onClick={resetForm}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-emerald-600" />
                  Información del Cliente
                </h3>
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Buscar Cliente
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Escribe para buscar por nombre, empresa o email..."
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                      required
                    />
                  </div>
                  {showClientDropdown && filteredClients.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      {filteredClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => selectClient(client)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 transition border-b border-slate-100 last:border-0"
                        >
                          <div className="flex items-center space-x-3">
                            {client.company_name ? (
                              <Building2 className="w-5 h-5 text-blue-500" />
                            ) : (
                              <User className="w-5 h-5 text-emerald-500" />
                            )}
                            <div>
                              <div className="font-semibold text-slate-900">
                                {client.company_name || client.contact_name}
                              </div>
                              <div className="text-sm text-slate-500">
                                {client.company_name && client.contact_name && `${client.contact_name} • `}
                                {client.email}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedClient && (
                    <div className="mt-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {selectedClient.company_name ? (
                            <Building2 className="w-8 h-8 text-blue-600" />
                          ) : (
                            <User className="w-8 h-8 text-emerald-600" />
                          )}
                          <div>
                            <div className="font-bold text-slate-900">
                              {selectedClient.company_name || selectedClient.contact_name}
                            </div>
                            {selectedClient.company_name && (
                              <div className="text-sm text-slate-600">{selectedClient.contact_name}</div>
                            )}
                            <div className="text-sm text-slate-500">{selectedClient.email}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClient(null);
                            setClientSearch('');
                          }}
                          className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2 text-blue-600" />
                    Fecha de Orden
                  </label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2 text-amber-600" />
                    Fecha de Entrega
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-2 text-emerald-600" />
                    Moneda
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  >
                    <option value="USD">USD - Dólar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="MXN">MXN - Peso Mexicano</option>
                    <option value="COP">COP - Peso Colombiano</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2 text-emerald-600" />
                  Items de la Orden
                </h3>

                <div className="bg-white rounded-xl p-4 mb-4 border border-slate-200">
                  <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
                      <input
                        type="text"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        placeholder="Descripción del producto o servicio"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo</label>
                      <select
                        value={newItem.item_type}
                        onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
                      >
                        <option value="product">Producto</option>
                        <option value="service">Servicio</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Cantidad</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Precio Unitario</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItem.unit_price}
                        onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Descuento %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newItem.discount_percent}
                        onChange={(e) => setNewItem({ ...newItem, discount_percent: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
                    <div className="text-sm">
                      <span className="text-slate-600">Total línea: </span>
                      <span className="font-bold text-emerald-600 text-lg">
                        ${newItem.line_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Item</span>
                    </button>
                  </div>
                </div>

                {orderItems.length > 0 && (
                  <div className="space-y-2">
                    {orderItems.map((item, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border border-slate-200 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className={`px-2 py-1 rounded text-xs font-semibold ${
                              item.item_type === 'product' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                            }`}>
                              {item.item_type === 'product' ? 'Producto' : 'Servicio'}
                            </div>
                            <div className="font-semibold text-slate-900">{item.description}</div>
                          </div>
                          <div className="text-sm text-slate-600 mt-1">
                            {item.quantity} × ${item.unit_price.toFixed(2)}
                            {item.discount_percent > 0 && <span className="text-amber-600"> (-{item.discount_percent}%)</span>}
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="font-bold text-emerald-600 text-lg">
                              ${item.line_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      <MapPin className="w-4 h-4 inline mr-2 text-blue-600" />
                      Dirección de Envío
                    </label>
                    <textarea
                      value={formData.shipping_address}
                      onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                      placeholder="Calle, ciudad, código postal..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      <MapPin className="w-4 h-4 inline mr-2 text-violet-600" />
                      Dirección de Facturación
                    </label>
                    <textarea
                      value={formData.billing_address}
                      onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                      placeholder="Calle, ciudad, código postal..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      <FileText className="w-4 h-4 inline mr-2 text-slate-600" />
                      Notas Internas
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                      placeholder="Notas internas de la orden..."
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
                    <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
                      <DollarSign className="w-4 h-4 mr-2 text-emerald-600" />
                      Resumen Financiero
                    </h4>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Subtotal:</span>
                        <span className="font-semibold text-slate-900">
                          ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="flex-1">
                          <label className="text-xs text-slate-600 block mb-1">Descuento:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.discount_amount}
                            onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 transition text-sm"
                          />
                        </div>
                        <div className="pt-6 text-slate-900 font-semibold">
                          -${formData.discount_amount.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="flex-1">
                          <label className="text-xs text-slate-600 block mb-1">IVA/Tax %:</label>
                          <input
                            type="number"
                            step="0.1"
                            value={formData.tax_rate}
                            onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 transition text-sm"
                          />
                        </div>
                        <div className="pt-6 text-slate-900 font-semibold">
                          ${taxAmount.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="flex-1">
                          <label className="text-xs text-slate-600 block mb-1">Envío:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.shipping_cost}
                            onChange={(e) => setFormData({ ...formData, shipping_cost: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 transition text-sm"
                          />
                        </div>
                        <div className="pt-6 text-slate-900 font-semibold">
                          ${formData.shipping_cost.toFixed(2)}
                        </div>
                      </div>

                      <div className="pt-3 border-t-2 border-slate-300 flex justify-between items-center">
                        <span className="text-lg font-bold text-slate-900">Total:</span>
                        <span className="text-2xl font-bold text-emerald-600">
                          ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        <CreditCard className="w-4 h-4 inline mr-2 text-blue-600" />
                        Términos de Pago
                      </label>
                      <select
                        value={formData.payment_terms}
                        onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                      >
                        <option value="Inmediato">Inmediato</option>
                        <option value="Net 15">Net 15</option>
                        <option value="Net 30">Net 30</option>
                        <option value="Net 60">Net 60</option>
                        <option value="Net 90">Net 90</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Estado de Pago
                      </label>
                      <select
                        value={formData.payment_status}
                        onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                      >
                        <option value="unpaid">Sin pagar</option>
                        <option value="partial">Parcial</option>
                        <option value="paid">Pagado</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </form>

            <div className="flex justify-end space-x-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex-shrink-0">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition shadow-lg font-semibold"
              >
                Crear Orden
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Detalles de Orden</h2>
                  <p className="text-blue-100 text-sm mt-1">{selectedOrder.order_number}</p>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                    <User className="w-5 h-5 mr-2 text-blue-600" />
                    Información del Cliente
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.clients?.company_name && (
                      <div>
                        <span className="text-sm text-slate-600">Empresa:</span>
                        <p className="font-semibold text-slate-900">{selectedOrder.clients.company_name}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-sm text-slate-600">Contacto:</span>
                      <p className="font-semibold text-slate-900">{selectedOrder.clients?.contact_name}</p>
                    </div>
                    <div>
                      <span className="text-sm text-slate-600">Email:</span>
                      <p className="font-semibold text-slate-900">{selectedOrder.clients?.email}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-emerald-600" />
                    Estado de la Orden
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Estado Actual:</label>
                      <select
                        value={selectedOrder.status}
                        onChange={(e) => updateStatus(selectedOrder.id, e.target.value as Order['status'])}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="confirmed">Confirmada</option>
                        <option value="in_progress">En Progreso</option>
                        <option value="completed">Completada</option>
                        <option value="cancelled">Cancelada</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-sm text-slate-600">Estado de Pago:</span>
                      <p className="font-semibold text-slate-900 mt-1">
                        {selectedOrder.payment_status === 'paid' ? 'Pagado' :
                         selectedOrder.payment_status === 'partial' ? 'Parcial' : 'Sin pagar'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-amber-600" />
                  Fechas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm text-slate-600">Fecha de Orden:</span>
                    <p className="font-semibold text-slate-900">
                      {new Date(selectedOrder.order_date).toLocaleDateString()}
                    </p>
                  </div>
                  {selectedOrder.due_date && (
                    <div>
                      <span className="text-sm text-slate-600">Fecha de Entrega:</span>
                      <p className="font-semibold text-slate-900">
                        {new Date(selectedOrder.due_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-slate-600">Términos de Pago:</span>
                    <p className="font-semibold text-slate-900">{selectedOrder.payment_terms}</p>
                  </div>
                </div>
              </div>

              {selectedOrder.external_order_id && (
                <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-blue-600" />
                    Información de DogCatify
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-slate-600">ID de Orden Externa:</span>
                      <p className="font-mono text-sm font-semibold text-slate-900 break-all">
                        {selectedOrder.external_order_id}
                      </p>
                    </div>
                    {selectedOrder.external_partner_id && (
                      <div>
                        <span className="text-sm text-slate-600">ID de Partner:</span>
                        <p className="font-mono text-sm font-semibold text-slate-900 break-all">
                          {selectedOrder.external_partner_id}
                        </p>
                      </div>
                    )}
                    {selectedOrder.payment_method && (
                      <div>
                        <span className="text-sm text-slate-600">Método de Pago:</span>
                        <p className="font-semibold text-slate-900">
                          {selectedOrder.payment_method}
                        </p>
                      </div>
                    )}
                    {selectedOrder.metadata && (
                      <div className="md:col-span-2">
                        <span className="text-sm text-slate-600">Datos Adicionales:</span>
                        <pre className="mt-2 p-3 bg-slate-100 rounded-lg text-xs overflow-x-auto">
                          {JSON.stringify(selectedOrder.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2 text-emerald-600" />
                  Items de la Orden
                </h3>
                {selectedOrderItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Tipo</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Descripción</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Cantidad</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Precio Unit.</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Desc.</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedOrderItems.map((item, index) => (
                          <tr key={item.id || index} className="hover:bg-slate-100 transition">
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                item.item_type === 'product'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {item.item_type === 'product' ? 'Producto' : 'Servicio'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-900">{item.description}</td>
                            <td className="px-4 py-3 text-center text-slate-900">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-900">
                              ${item.unit_price.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-900">
                              {item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              ${item.line_total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-8">No hay items en esta orden</p>
                )}
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-emerald-600" />
                  Resumen Financiero
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Subtotal:</span>
                    <span className="font-semibold text-slate-900">
                      ${selectedOrder.subtotal.toFixed(2)} {selectedOrder.currency}
                    </span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">Descuento:</span>
                      <span className="font-semibold text-red-600">
                        -${selectedOrder.discount_amount.toFixed(2)} {selectedOrder.currency}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">IVA/Tax ({selectedOrder.tax_rate}%):</span>
                    <span className="font-semibold text-slate-900">
                      ${selectedOrder.tax_amount.toFixed(2)} {selectedOrder.currency}
                    </span>
                  </div>
                  {selectedOrder.shipping_cost > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">Envío:</span>
                      <span className="font-semibold text-slate-900">
                        ${selectedOrder.shipping_cost.toFixed(2)} {selectedOrder.currency}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 border-t-2 border-emerald-300 flex justify-between items-center">
                    <span className="text-lg font-bold text-slate-900">Total:</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      ${selectedOrder.total_amount.toFixed(2)} {selectedOrder.currency}
                    </span>
                  </div>
                </div>
              </div>

              {(selectedOrder.notes || selectedOrder.customer_notes || selectedOrder.shipping_address || selectedOrder.billing_address) && (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-blue-600" />
                    Información Adicional
                  </h3>
                  <div className="space-y-4">
                    {selectedOrder.notes && (
                      <div>
                        <span className="text-sm font-semibold text-slate-700">Notas Internas:</span>
                        <p className="text-slate-900 mt-1">{selectedOrder.notes}</p>
                      </div>
                    )}
                    {selectedOrder.customer_notes && (
                      <div>
                        <span className="text-sm font-semibold text-slate-700">Notas del Cliente:</span>
                        <p className="text-slate-900 mt-1">{selectedOrder.customer_notes}</p>
                      </div>
                    )}
                    {selectedOrder.shipping_address && (
                      <div>
                        <span className="text-sm font-semibold text-slate-700">Dirección de Envío:</span>
                        <p className="text-slate-900 mt-1">{selectedOrder.shipping_address}</p>
                      </div>
                    )}
                    {selectedOrder.billing_address && (
                      <div>
                        <span className="text-sm font-semibold text-slate-700">Dirección de Facturación:</span>
                        <p className="text-slate-900 mt-1">{selectedOrder.billing_address}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex-shrink-0">
              <button
                onClick={() => generatePaymentLink(selectedOrder)}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition shadow-lg font-semibold flex items-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Copiar Link de Pago
              </button>
              <button
                onClick={() => setShowViewModal(false)}
                className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 transition font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
