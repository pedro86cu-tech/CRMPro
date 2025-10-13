import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  CreditCard,
  Eye,
  Download,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  X,
  BarChart3,
  PieChart,
  Receipt
} from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  status: string;
  order_date: string;
  clients: {
    contact_name: string;
    company_name?: string;
    email: string;
  };
}

interface Payment {
  id: string;
  order_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
  orders: {
    order_number: string;
    total_amount: number;
    clients: {
      contact_name: string;
      company_name?: string;
    };
  };
}

interface FinancialSummary {
  totalRevenue: number;
  totalPending: number;
  totalPaid: number;
  totalPartial: number;
  ordersCount: number;
  paymentsCount: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  payments: number;
  pending: number;
}

export function AccountingModule() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'reports' | 'receivables'>('overview');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalRevenue: 0,
    totalPending: 0,
    totalPaid: 0,
    totalPartial: 0,
    ordersCount: 0,
    paymentsCount: 0
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    try {
      setLoading(true);

      const [ordersResult, paymentsResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*, clients(contact_name, company_name, email)')
          .order('order_date', { ascending: false }),
        supabase
          .from('payment_transactions')
          .select('*, orders(order_number, total_amount, clients(contact_name, company_name))')
          .order('payment_date', { ascending: false })
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const ordersData = ordersResult.data || [];
      const paymentsData = paymentsResult.data || [];

      setOrders(ordersData);
      setPayments(paymentsData);

      const totalRevenue = ordersData.reduce((sum, order) => sum + order.total_amount, 0);
      const totalPaid = ordersData.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + o.total_amount, 0);
      const totalPartial = ordersData.filter(o => o.payment_status === 'partial').reduce((sum, o) => sum + o.total_amount, 0);
      const totalPending = ordersData.filter(o => o.payment_status === 'unpaid').reduce((sum, o) => sum + o.total_amount, 0);

      setSummary({
        totalRevenue,
        totalPending,
        totalPaid,
        totalPartial,
        ordersCount: ordersData.length,
        paymentsCount: paymentsData.length
      });

      calculateMonthlyData(ordersData, paymentsData);

      setLoading(false);
    } catch (error) {
      toast.error('Error al cargar datos financieros');
      setLoading(false);
    }
  };

  const calculateMonthlyData = (ordersData: Order[], paymentsData: Payment[]) => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentYear = new Date().getFullYear();
    const data: MonthlyData[] = [];

    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.getMonth();
      const year = date.getFullYear();

      const monthOrders = ordersData.filter(o => {
        const orderDate = new Date(o.order_date);
        return orderDate.getMonth() === month && orderDate.getFullYear() === year;
      });

      const monthPayments = paymentsData.filter(p => {
        const paymentDate = new Date(p.payment_date);
        return paymentDate.getMonth() === month && paymentDate.getFullYear() === year;
      });

      const revenue = monthOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const payments = monthPayments.reduce((sum, p) => sum + p.amount, 0);
      const pending = monthOrders.filter(o => o.payment_status === 'unpaid').reduce((sum, o) => sum + o.total_amount, 0);

      data.unshift({
        month: months[month],
        revenue,
        payments,
        pending
      });
    }

    setMonthlyData(data);
  };

  const openPaymentModal = (order: Order) => {
    setSelectedOrder(order);
    setPaymentForm({
      amount: order.total_amount.toString(),
      payment_method: 'bank_transfer',
      reference_number: '',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handleRegisterPayment = async () => {
    if (!selectedOrder) return;

    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    if (amount > selectedOrder.total_amount) {
      toast.error('El monto no puede ser mayor al total de la orden');
      return;
    }

    try {
      const { error: paymentError } = await supabase
        .from('payment_transactions')
        .insert({
          order_id: selectedOrder.id,
          amount,
          payment_method: paymentForm.payment_method,
          reference_number: paymentForm.reference_number || null,
          notes: paymentForm.notes || null,
          payment_date: new Date().toISOString()
        });

      if (paymentError) throw paymentError;

      const { data: existingPayments } = await supabase
        .from('payment_transactions')
        .select('amount')
        .eq('order_id', selectedOrder.id);

      const totalPaid = (existingPayments || []).reduce((sum, p) => sum + p.amount, 0) + amount;

      let newPaymentStatus: 'unpaid' | 'partial' | 'paid';
      if (totalPaid >= selectedOrder.total_amount) {
        newPaymentStatus = 'paid';
      } else if (totalPaid > 0) {
        newPaymentStatus = 'partial';
      } else {
        newPaymentStatus = 'unpaid';
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_status: newPaymentStatus })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      toast.success('Pago registrado exitosamente');
      setShowPaymentModal(false);
      loadFinancialData();
    } catch (error) {
      toast.error('Error al registrar el pago');
    }
  };

  const exportReport = (type: string) => {
    toast.success(`Exportando reporte: ${type}`);
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.clients?.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unpaidOrders = filteredOrders.filter(o => o.payment_status === 'unpaid');
  const partialOrders = filteredOrders.filter(o => o.payment_status === 'partial');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Contabilidad y Finanzas</h1>
        <p className="text-slate-600">Gestión completa de pagos, reportes y cuentas por cobrar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <DollarSign className="w-8 h-8" />
            </div>
            <TrendingUp className="w-6 h-6 opacity-80" />
          </div>
          <div className="text-3xl font-bold mb-1">
            ${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-emerald-100 text-sm font-medium">Ingresos Totales</div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <CheckCircle className="w-8 h-8" />
            </div>
            <TrendingUp className="w-6 h-6 opacity-80" />
          </div>
          <div className="text-3xl font-bold mb-1">
            ${summary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-blue-100 text-sm font-medium">Pagado</div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Clock className="w-8 h-8" />
            </div>
            <TrendingDown className="w-6 h-6 opacity-80" />
          </div>
          <div className="text-3xl font-bold mb-1">
            ${summary.totalPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-amber-100 text-sm font-medium">Por Cobrar</div>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Receipt className="w-8 h-8" />
            </div>
            <FileText className="w-6 h-6 opacity-80" />
          </div>
          <div className="text-3xl font-bold mb-1">{summary.paymentsCount}</div>
          <div className="text-violet-100 text-sm font-medium">Transacciones</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-8">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 rounded-xl font-medium transition ${
                activeTab === 'overview'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Resumen
              </div>
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-6 py-3 rounded-xl font-medium transition ${
                activeTab === 'payments'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Registro de Pagos
              </div>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-6 py-3 rounded-xl font-medium transition ${
                activeTab === 'reports'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Reportes
              </div>
            </button>
            <button
              onClick={() => setActiveTab('receivables')}
              className={`px-6 py-3 rounded-xl font-medium transition ${
                activeTab === 'receivables'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Cuentas por Cobrar
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Resumen Financiero</h2>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-emerald-600 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-slate-900">Pagos Completados</h3>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600 mb-1">
                    ${summary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-slate-600">
                    {((summary.totalPaid / summary.totalRevenue) * 100 || 0).toFixed(1)}% del total
                  </p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-600 rounded-lg">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-slate-900">Pendientes</h3>
                  </div>
                  <p className="text-3xl font-bold text-amber-600 mb-1">
                    ${summary.totalPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-slate-600">
                    {((summary.totalPending / summary.totalRevenue) * 100 || 0).toFixed(1)}% del total
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-slate-900">Pagos Parciales</h3>
                  </div>
                  <p className="text-3xl font-bold text-blue-600 mb-1">
                    ${summary.totalPartial.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-slate-600">
                    {((summary.totalPartial / summary.totalRevenue) * 100 || 0).toFixed(1)}% del total
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
                <h3 className="text-xl font-bold text-slate-900 mb-4">Flujo de Caja (Últimos 6 meses)</h3>
                <div className="grid grid-cols-6 gap-4">
                  {monthlyData.map((data, index) => {
                    const maxValue = Math.max(...monthlyData.map(d => Math.max(d.revenue, d.payments, d.pending)));
                    const revenueHeight = (data.revenue / maxValue) * 100;
                    const paymentsHeight = (data.payments / maxValue) * 100;
                    const pendingHeight = (data.pending / maxValue) * 100;

                    return (
                      <div key={index} className="text-center">
                        <div className="h-48 flex items-end justify-center gap-1 mb-2">
                          <div
                            className="w-6 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-lg transition-all hover:opacity-80"
                            style={{ height: `${revenueHeight}%` }}
                            title={`Ingresos: $${data.revenue.toFixed(2)}`}
                          ></div>
                          <div
                            className="w-6 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all hover:opacity-80"
                            style={{ height: `${paymentsHeight}%` }}
                            title={`Pagos: $${data.payments.toFixed(2)}`}
                          ></div>
                          <div
                            className="w-6 bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-lg transition-all hover:opacity-80"
                            style={{ height: `${pendingHeight}%` }}
                            title={`Pendiente: $${data.pending.toFixed(2)}`}
                          ></div>
                        </div>
                        <p className="text-sm font-medium text-slate-700">{data.month}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-slate-300">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                    <span className="text-sm text-slate-700">Ingresos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span className="text-sm text-slate-700">Pagos Recibidos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-500 rounded"></div>
                    <span className="text-sm text-slate-700">Pendiente</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Registro de Pagos</h2>
                <button
                  onClick={() => exportReport('payments')}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar
                </button>
              </div>

              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar por número de orden, cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {payments.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl">
                    <Receipt className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 text-lg">No hay pagos registrados</p>
                    <p className="text-slate-500 text-sm mt-2">Los pagos aparecerán aquí cuando se registren</p>
                  </div>
                ) : (
                  payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="bg-gradient-to-r from-white to-slate-50 rounded-xl p-5 border border-slate-200 hover:shadow-md transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                              <CheckCircle className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{payment.orders.order_number}</p>
                              <p className="text-sm text-slate-600">
                                {payment.orders.clients?.company_name || payment.orders.clients?.contact_name}
                              </p>
                            </div>
                          </div>
                          <div className="ml-11 grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">Monto</p>
                              <p className="font-semibold text-emerald-600">
                                ${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Método</p>
                              <p className="font-semibold text-slate-900 capitalize">
                                {payment.payment_method.replace('_', ' ')}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Fecha</p>
                              <p className="font-semibold text-slate-900">
                                {new Date(payment.payment_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Referencia</p>
                              <p className="font-semibold text-slate-900">
                                {payment.reference_number || 'N/A'}
                              </p>
                            </div>
                          </div>
                          {payment.notes && (
                            <div className="ml-11 mt-2">
                              <p className="text-sm text-slate-600 italic">{payment.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Reportes Avanzados</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-emerald-600 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Flujo de Caja</h3>
                  </div>
                  <p className="text-slate-700 mb-4">
                    Análisis detallado de entradas y salidas de efectivo mensual
                  </p>
                  <button
                    onClick={() => exportReport('cash-flow')}
                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Generar Reporte
                  </button>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-600 rounded-lg">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Estado de Resultados</h3>
                  </div>
                  <p className="text-slate-700 mb-4">
                    Resumen de ingresos, gastos y utilidades del período
                  </p>
                  <button
                    onClick={() => exportReport('income-statement')}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Generar Reporte
                  </button>
                </div>

                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-6 border border-violet-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-violet-600 rounded-lg">
                      <PieChart className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Análisis de Rentabilidad</h3>
                  </div>
                  <p className="text-slate-700 mb-4">
                    Evaluación de márgenes y rentabilidad por cliente y producto
                  </p>
                  <button
                    onClick={() => exportReport('profitability')}
                    className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Generar Reporte
                  </button>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-amber-600 rounded-lg">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Aging de Cuentas</h3>
                  </div>
                  <p className="text-slate-700 mb-4">
                    Antigüedad de saldos por cobrar por período de vencimiento
                  </p>
                  <button
                    onClick={() => exportReport('aging')}
                    className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Generar Reporte
                  </button>
                </div>
              </div>

              <div className="mt-8 p-6 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-3">Nota sobre Exportación</h3>
                <p className="text-slate-700 leading-relaxed">
                  Los reportes se pueden exportar en múltiples formatos (PDF, Excel, CSV) según tus necesidades.
                  Cada reporte incluye gráficos, tablas detalladas y análisis comparativos para facilitar la
                  toma de decisiones financieras.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'receivables' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Cuentas por Cobrar</h2>
                <button
                  onClick={() => exportReport('receivables')}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                  <p className="text-sm text-slate-600 mb-1">Sin Pagar</p>
                  <p className="text-2xl font-bold text-amber-600">{unpaidOrders.length}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    ${unpaidOrders.reduce((sum, o) => sum + o.total_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-sm text-slate-600 mb-1">Pagos Parciales</p>
                  <p className="text-2xl font-bold text-blue-600">{partialOrders.length}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    ${partialOrders.reduce((sum, o) => sum + o.total_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
                  <p className="text-sm text-slate-600 mb-1">Total por Cobrar</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    ${(summary.totalPending + summary.totalPartial).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">{unpaidOrders.length + partialOrders.length} órdenes</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar por número de orden, cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {[...unpaidOrders, ...partialOrders].length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl">
                    <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                    <p className="text-slate-600 text-lg">¡Excelente! No hay cuentas pendientes</p>
                    <p className="text-slate-500 text-sm mt-2">Todas las órdenes han sido pagadas</p>
                  </div>
                ) : (
                  [...unpaidOrders, ...partialOrders].map((order) => (
                    <div
                      key={order.id}
                      className="bg-gradient-to-r from-white to-slate-50 rounded-xl p-5 border border-slate-200 hover:shadow-md transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${
                              order.payment_status === 'unpaid' ? 'bg-amber-100' : 'bg-blue-100'
                            }`}>
                              {order.payment_status === 'unpaid' ? (
                                <Clock className="w-5 h-5 text-amber-600" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{order.order_number}</p>
                              <p className="text-sm text-slate-600">
                                {order.clients?.company_name || order.clients?.contact_name}
                              </p>
                            </div>
                          </div>
                          <div className="ml-11 grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">Total</p>
                              <p className="font-semibold text-slate-900">
                                ${order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Estado</p>
                              <p className={`font-semibold capitalize ${
                                order.payment_status === 'unpaid' ? 'text-amber-600' : 'text-blue-600'
                              }`}>
                                {order.payment_status === 'unpaid' ? 'Sin pagar' : 'Pago parcial'}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Fecha</p>
                              <p className="font-semibold text-slate-900">
                                {new Date(order.order_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => openPaymentModal(order)}
                          className="ml-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Registrar Pago
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Registrar Pago</h2>
                  <p className="text-emerald-100 mt-1">Orden: {selectedOrder.order_number}</p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 mb-6 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-600">Cliente</p>
                  <p className="font-semibold text-slate-900">
                    {selectedOrder.clients?.company_name || selectedOrder.clients?.contact_name}
                  </p>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-600">Total de la Orden</p>
                  <p className="font-semibold text-slate-900">
                    ${selectedOrder.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-slate-600">Estado de Pago</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedOrder.payment_status === 'unpaid'
                      ? 'bg-amber-100 text-amber-700'
                      : selectedOrder.payment_status === 'partial'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedOrder.payment_status === 'unpaid' ? 'Sin pagar' :
                     selectedOrder.payment_status === 'partial' ? 'Parcial' : 'Pagado'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Monto a Pagar *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Método de Pago *
                  </label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="bank_transfer">Transferencia Bancaria</option>
                    <option value="cash">Efectivo</option>
                    <option value="credit_card">Tarjeta de Crédito</option>
                    <option value="debit_card">Tarjeta de Débito</option>
                    <option value="check">Cheque</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número de Referencia
                  </label>
                  <input
                    type="text"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Ej: TRANS-12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notas
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    rows={3}
                    placeholder="Información adicional sobre el pago..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegisterPayment}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Registrar Pago
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
