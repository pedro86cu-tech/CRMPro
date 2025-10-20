import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Plus, FileText, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Clock, Search, Calendar, Building2, Download, Send, X, Trash2, Eye, CreditCard as Edit, ShoppingCart, Percent, Hash, Package } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
  subtotal: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  order_id?: string;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  terms?: string;
  created_at: string;
  numero_cfe?: string;
  serie_cfe?: string;
  tipo_cfe?: string;
  cae?: string;
  vencimiento_cae?: string;
  dgi_estado?: string;
  dgi_codigo_autorizacion?: string;
  dgi_mensaje?: string;
  validated_at?: string;
  observations?: string;
  clients?: {
    contact_name: string;
    company_name?: string;
    email: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
  };
  orders?: {
    order_number: string;
    status: string;
  };
}

interface InvoiceItemDB {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
  subtotal: number;
}

interface InvoiceStatus {
  code: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export function InvoicesModule() {
  const toast = useToast();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceStatuses, setInvoiceStatuses] = useState<InvoiceStatus[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<InvoiceItemDB[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
    totalRevenue: 0,
    pending: 0,
    thisMonth: 0
  });

  const [formData, setFormData] = useState({
    invoice_number: '',
    client_id: '',
    order_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    status: 'draft',
    notes: '',
    terms: 'Pago a 30 días. Penalización por retraso del 2% mensual.'
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount: 0, subtotal: 0 }
  ]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    loadInvoiceStatuses();
    loadInvoices();
    loadClients();
    loadOrders();
    generateInvoiceNumber();

    const channel = supabase
      .channel('invoices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices'
        },
        (payload) => {
          console.log('Invoice realtime update:', payload);
          loadInvoices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadInvoiceStatuses = async () => {
    const { data, error } = await supabase
      .from('invoice_statuses')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error loading invoice statuses:', error);
      return;
    }

    if (data) {
      setInvoiceStatuses(data);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.client-search-container')) {
        setShowClientDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    processEmailQueue();

    const interval = setInterval(() => {
      processEmailQueue();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const generateInvoiceNumber = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastNumber = parseInt(data[0].invoice_number.split('-')[1]);
      setFormData(prev => ({
        ...prev,
        invoice_number: `INV-${String(lastNumber + 1).padStart(5, '0')}`
      }));
    } else {
      setFormData(prev => ({ ...prev, invoice_number: 'INV-00001' }));
    }
  };

  const loadInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        clients(contact_name, company_name, email, address, city, country, phone),
        orders(order_number, status)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInvoices(data);
      calculateStats(data);
    }
  };

  const processEmailQueue = async () => {
    const { data: queueItems, error: queueError } = await supabase
      .from('invoice_email_queue')
      .select('id, invoice_id')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5);

    if (queueError || !queueItems || queueItems.length === 0) {
      return;
    }

    for (const item of queueItems) {
      await supabase
        .from('invoice_email_queue')
        .update({ status: 'processing' })
        .eq('id', item.id);

      try {
        const response = await supabase.functions.invoke('send-invoice-email', {
          body: { invoice_id: item.invoice_id }
        });

        if (response.error) {
          await supabase
            .from('invoice_email_queue')
            .update({
              status: 'failed',
              last_error: response.error.message,
              attempts: supabase.rpc('increment', { row_id: item.id })
            })
            .eq('id', item.id);
        } else {
          await supabase
            .from('invoice_email_queue')
            .update({
              status: 'sent',
              processed_at: new Date().toISOString()
            })
            .eq('id', item.id);

          toast.success('Factura enviada por email automáticamente');
        }
      } catch (error: any) {
        await supabase
          .from('invoice_email_queue')
          .update({
            status: 'failed',
            last_error: error.message
          })
          .eq('id', item.id);
      }
    }
  };

  const calculateStats = (invoicesData: Invoice[]) => {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalRevenue = invoicesData
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.total_amount), 0);

    const pending = invoicesData
      .filter(i => i.status === 'sent' || i.status === 'overdue')
      .reduce((sum, i) => sum + Number(i.total_amount), 0);

    setStats({
      total: invoicesData.length,
      draft: invoicesData.filter(i => i.status === 'draft').length,
      sent: invoicesData.filter(i => i.status === 'sent').length,
      paid: invoicesData.filter(i => i.status === 'paid').length,
      overdue: invoicesData.filter(i => i.status === 'overdue').length,
      cancelled: invoicesData.filter(i => i.status === 'cancelled').length,
      totalRevenue,
      pending,
      thisMonth: invoicesData.filter(i => new Date(i.created_at) >= firstDayThisMonth).length
    });
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, contact_name, company_name, email')
      .in('status', ['active', 'prospect'])
      .order('contact_name', { ascending: true, nullsFirst: false });
    if (data) {
      setClients(data);
      setFilteredClients(data);
    }
  };

  const searchClients = (searchValue: string) => {
    setClientSearchTerm(searchValue);

    if (!searchValue.trim()) {
      setFilteredClients(clients);
      setShowClientDropdown(true);
      return;
    }

    const filtered = clients.filter(client => {
      const companyName = client.company_name?.toLowerCase() || '';
      const contactName = client.contact_name?.toLowerCase() || '';
      const email = client.email?.toLowerCase() || '';
      const search = searchValue.toLowerCase();

      return companyName.includes(search) ||
             contactName.includes(search) ||
             email.includes(search);
    });

    setFilteredClients(filtered);
    setShowClientDropdown(true);
  };

  const selectClient = (client: any) => {
    setSelectedClient(client);
    setFormData(prev => ({ ...prev, client_id: client.id }));
    setClientSearchTerm(client.company_name || client.contact_name);
    setShowClientDropdown(false);
  };

  const loadOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, client_id, clients(company_name)')
      .in('status', ['pending', 'processing', 'completed', 'confirmed'])
      .order('order_date', { ascending: false });
    if (data) setOrders(data);
  };

  const handleOrderSelect = async (orderId: string) => {
    if (!orderId) {
      setFormData(prev => ({
        ...prev,
        client_id: '',
        order_id: ''
      }));
      setSelectedClient(null);
      setClientSearchTerm('');
      return;
    }

    const { data: orderData } = await supabase
      .from('orders')
      .select('*, clients(id, contact_name, company_name, email), order_items(*)')
      .eq('id', orderId)
      .single();

    if (orderData) {
      const clientInfo = orderData.clients;
      setSelectedClient(clientInfo);
      setClientSearchTerm(clientInfo.company_name || clientInfo.contact_name);

      setFormData(prev => ({
        ...prev,
        client_id: orderData.client_id,
        order_id: orderId
      }));

      if (orderData.order_items && orderData.order_items.length > 0) {
        const orderItems = orderData.order_items.map((item: any) => ({
          description: item.product_name || item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: 0,
          discount: 0,
          subtotal: item.quantity * item.unit_price
        }));
        setItems(orderItems);
        calculateTotals(orderItems);
      }
    }
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount: 0, subtotal: 0 }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    calculateTotals(newItems);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    const quantity = newItems[index].quantity;
    const unitPrice = newItems[index].unit_price;
    const discount = newItems[index].discount || 0;
    const taxRate = newItems[index].tax_rate || 0;

    const subtotalBeforeDiscount = quantity * unitPrice;
    const discountAmount = (subtotalBeforeDiscount * discount) / 100;
    const subtotalAfterDiscount = subtotalBeforeDiscount - discountAmount;
    const taxAmount = (subtotalAfterDiscount * taxRate) / 100;
    newItems[index].subtotal = subtotalAfterDiscount + taxAmount;

    setItems(newItems);
    calculateTotals(newItems);
  };

  const calculateTotals = (itemsList: InvoiceItem[]) => {
    const subtotal = itemsList.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unit_price;
      return sum + itemSubtotal;
    }, 0);

    const discountAmount = itemsList.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unit_price;
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      return sum + itemDiscount;
    }, 0);

    const subtotalAfterDiscount = subtotal - discountAmount;

    const taxAmount = itemsList.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unit_price;
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      const itemSubtotalAfterDiscount = itemSubtotal - itemDiscount;
      const itemTax = (itemSubtotalAfterDiscount * (item.tax_rate || 0)) / 100;
      return sum + itemTax;
    }, 0);

    return {
      subtotal,
      discountAmount,
      taxAmount,
      total: subtotalAfterDiscount + taxAmount
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0 || items.every(item => !item.description)) {
      toast.error('Agregue al menos un ítem a la factura');
      return;
    }

    const totals = calculateTotals(items);

    try {
      const invoiceData = {
        invoice_number: formData.invoice_number,
        client_id: formData.client_id,
        order_id: formData.order_id || null,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        status: formData.status,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: totals.discountAmount,
        total_amount: totals.total,
        notes: formData.notes || null,
        terms: formData.terms || null,
        created_by: user?.id || null
      };

      let invoiceId: string;

      const previousStatus = editingId ? (invoices.find(inv => inv.id === editingId)?.status) : null;

      if (editingId) {
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editingId);

        if (error) throw error;

        await supabase.from('invoice_items').delete().eq('invoice_id', editingId);
        invoiceId = editingId;
        toast.success('Factura actualizada exitosamente');
      } else {
        const { data, error } = await supabase
          .from('invoices')
          .insert(invoiceData)
          .select()
          .single();

        if (error) throw error;
        invoiceId = data.id;
        toast.success('Factura creada exitosamente');
      }

      const itemsToInsert = items
        .filter(item => item.description)
        .map(item => ({
          invoice_id: invoiceId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate || 0,
          discount: item.discount || 0,
          subtotal: item.subtotal
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      if (formData.status === 'validated' && previousStatus !== 'validated') {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

          const response = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ invoice_id: invoiceId })
          });

          if (response.ok) {
            toast.success('Factura enviada por email exitosamente');
          } else {
            const error = await response.json();
            console.error('Error enviando email:', error);
            toast.error('Factura guardada pero no se pudo enviar el email');
          }
        } catch (emailError) {
          console.error('Error enviando email:', emailError);
          toast.error('Factura guardada pero no se pudo enviar el email');
        }
      }

      loadInvoices();
      resetForm();
    } catch (error) {
      toast.error('Error al guardar la factura');
    }
  };

  const resetForm = () => {
    setFormData({
      invoice_number: '',
      client_id: '',
      order_id: '',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: '',
      status: 'draft',
      notes: '',
      terms: 'Pago a 30 días. Penalización por retraso del 2% mensual.'
    });
    setItems([{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount: 0, subtotal: 0 }]);
    setSelectedClient(null);
    setClientSearchTerm('');
    setShowClientDropdown(false);
    setShowModal(false);
    setEditingId(null);
    generateInvoiceNumber();
  };

  const updateStatus = async (invoiceId: string, newStatus: Invoice['status']) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoiceId);

    if (!error) {
      toast.success('Estado actualizado');
      loadInvoices();
    } else {
      toast.error('Error al actualizar estado');
    }
  };

  const handleEdit = async (invoice: Invoice) => {
    setEditingId(invoice.id);

    if (invoice.clients) {
      setSelectedClient(invoice.clients);
      setClientSearchTerm(invoice.clients.company_name || invoice.clients.contact_name);
    }

    setFormData({
      invoice_number: invoice.invoice_number,
      client_id: invoice.client_id,
      order_id: invoice.order_id || '',
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      status: invoice.status,
      notes: invoice.notes || '',
      terms: invoice.terms || 'Pago a 30 días. Penalización por retraso del 2% mensual.'
    });

    const { data: itemsData } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    if (itemsData && itemsData.length > 0) {
      setItems(itemsData.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        discount: item.discount,
        subtotal: item.subtotal
      })));
    }

    setShowModal(true);
  };

  const handleView = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const { data: itemsData } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    if (itemsData) {
      setSelectedInvoiceItems(itemsData);
    }
    setShowViewModal(true);
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('¿Está seguro de eliminar esta factura?')) return;

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId);

    if (!error) {
      toast.success('Factura eliminada');
      loadInvoices();
    } else {
      toast.error('Error al eliminar factura');
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.clients?.contact_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

  const getStatusStyle = (status: string) => {
    const statusConfig = invoiceStatuses.find(s => s.code === status);
    if (statusConfig && statusConfig.color) {
      return {
        backgroundColor: `${statusConfig.color}15`,
        color: statusConfig.color,
        borderColor: `${statusConfig.color}40`
      };
    }
    return {
      backgroundColor: '#f1f5f9',
      color: '#475569',
      borderColor: '#e2e8f0'
    };
  };

  const getStatusLabel = (status: string) => {
    const statusConfig = invoiceStatuses.find(s => s.code === status);
    return statusConfig?.name || status;
  };

  const totals = calculateTotals(items);

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Gestión de Facturas</h1>
        <p className="text-slate-600">Control financiero y facturación profesional</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <DollarSign className="w-8 h-8" />
            </div>
            <TrendingUp className="w-5 h-5 opacity-80" />
          </div>
          <div className="space-y-1">
            <p className="text-emerald-100 text-sm font-medium">Ingresos</p>
            <p className="text-3xl font-bold">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-emerald-100 text-xs">{stats.paid} pagadas</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Clock className="w-8 h-8" />
            </div>
            <FileText className="w-5 h-5 opacity-80" />
          </div>
          <div className="space-y-1">
            <p className="text-blue-100 text-sm font-medium">Pendientes</p>
            <p className="text-3xl font-bold">${stats.pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-blue-100 text-xs">{stats.sent} enviadas</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-red-100 text-sm font-medium">Vencidas</p>
            <p className="text-3xl font-bold">{stats.overdue}</p>
            <p className="text-red-100 text-xs">requieren atención</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <FileText className="w-8 h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-violet-100 text-sm font-medium">Total Facturas</p>
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-violet-100 text-xs">{stats.thisMonth} este mes</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar facturas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition shadow-lg ml-4"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva Factura</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Número / CFE</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Cliente</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Monto</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Emisión</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Estado</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg">No hay facturas registradas</p>
                    <p className="text-slate-400 text-sm mt-2">Crea tu primera factura para comenzar</p>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <div className={`${invoice.numero_cfe ? 'bg-blue-100' : 'bg-emerald-100'} p-2 rounded-lg`}>
                          <FileText className={`w-4 h-4 ${invoice.numero_cfe ? 'text-blue-600' : 'text-emerald-600'}`} />
                        </div>
                        <div>
                          {invoice.numero_cfe ? (
                            <>
                              <p className="font-bold text-blue-600 text-sm">CFE: {invoice.numero_cfe}</p>
                              {invoice.serie_cfe && (
                                <p className="text-xs text-slate-500">Serie: {invoice.serie_cfe}</p>
                              )}
                              <p className="text-xs text-slate-400">{invoice.invoice_number}</p>
                            </>
                          ) : (
                            <span className="font-semibold text-slate-900">{invoice.invoice_number}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-slate-900 font-medium">
                            {invoice.clients?.company_name || invoice.clients?.contact_name}
                          </p>
                          {invoice.order_id && invoice.orders && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <ShoppingCart className="w-3 h-3" />
                              {invoice.orders.order_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-lg font-bold text-emerald-600">
                        ${invoice.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <span className="text-sm text-slate-600">
                          {new Date(invoice.issue_date).toLocaleDateString()}
                        </span>
                        {invoice.tipo_cfe && (
                          <p className="text-xs text-blue-600 font-medium mt-1">{invoice.tipo_cfe}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium border w-fit"
                          style={getStatusStyle(invoice.status)}
                        >
                          {getStatusLabel(invoice.status)}
                        </span>
                        {invoice.dgi_estado && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${
                            invoice.dgi_estado === 'aprobado'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : invoice.dgi_estado === 'rechazado'
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                          }`}>
                            DGI: {invoice.dgi_estado}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleView(invoice)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                          title="Ver"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(invoice)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Descargar">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredInvoices.length)} de {filteredInvoices.length} facturas
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Anterior
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        currentPage === page
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{editingId ? 'Editar Factura' : 'Nueva Factura'}</h2>
                  <p className="text-emerald-100 mt-1">Complete la información de la factura</p>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4" />
                      Número de Factura *
                    </div>
                  </label>
                  <input
                    type="text"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="INV-00001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Orden (Opcional)
                    </div>
                  </label>
                  <select
                    value={formData.order_id}
                    onChange={(e) => handleOrderSelect(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Sin orden asociada</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.order_number} - {order.clients?.company_name} - ${order.total_amount}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Cliente *
                    </div>
                  </label>
                  {formData.order_id ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={clientSearchTerm}
                        readOnly
                        className="w-full px-4 py-3 border border-slate-300 bg-slate-50 rounded-xl text-slate-900 cursor-not-allowed"
                        placeholder="Cliente asignado desde la orden"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-medium">
                        Desde Orden
                      </div>
                    </div>
                  ) : (
                    <div className="relative client-search-container">
                      <input
                        type="text"
                        value={clientSearchTerm}
                        onChange={(e) => searchClients(e.target.value)}
                        onFocus={() => {
                          setShowClientDropdown(true);
                          if (!clientSearchTerm) {
                            setFilteredClients(clients);
                          }
                        }}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="Buscar cliente por nombre, empresa o email..."
                        required
                      />
                      {showClientDropdown && filteredClients.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {filteredClients.map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => selectClient(client)}
                              className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition border-b border-slate-100 last:border-b-0"
                            >
                              <div className="flex items-center gap-3">
                                <div className="bg-emerald-100 p-2 rounded-lg">
                                  <Building2 className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-slate-900">
                                    {client.company_name || client.contact_name}
                                  </p>
                                  <p className="text-sm text-slate-500">{client.email}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {showClientDropdown && filteredClients.length === 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-center text-slate-500">
                          No se encontraron clientes
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Fecha de Emisión *
                    </div>
                  </label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Fecha de Vencimiento *
                    </div>
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Estado
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    {invoiceStatuses.map(status => (
                      <option key={status.code} value={status.code}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Ítems de la Factura
                  </h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Ítem
                  </button>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={index} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-12 md:col-span-4">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Descripción *</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                            placeholder="Producto o servicio"
                            required
                          />
                        </div>

                        <div className="col-span-6 md:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad *</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>

                        <div className="col-span-6 md:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Precio Unit. *</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>

                        <div className="col-span-6 md:col-span-1">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Desc. %</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discount}
                            onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="col-span-6 md:col-span-1">
                          <label className="block text-xs font-medium text-slate-600 mb-1">IVA %</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.tax_rate}
                            onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="col-span-10 md:col-span-1 flex items-end">
                          <div className="w-full">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Subtotal</label>
                            <div className="px-3 py-2 bg-slate-200 rounded-lg text-sm font-semibold text-slate-900">
                              ${item.subtotal.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div className="col-span-2 md:col-span-1 flex items-end">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="w-full p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                            disabled={items.length === 1}
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
                <div className="flex justify-end">
                  <div className="w-full md:w-96 space-y-3">
                    <div className="flex justify-between text-slate-700">
                      <span>Subtotal:</span>
                      <span className="font-semibold">${totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Descuento:</span>
                      <span className="font-semibold text-red-600">-${totals.discountAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>IVA:</span>
                      <span className="font-semibold">${totals.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-emerald-600 pt-3 border-t-2 border-emerald-200">
                      <span>TOTAL:</span>
                      <span>${totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    rows={3}
                    placeholder="Información adicional para el cliente..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Términos y Condiciones</label>
                  <textarea
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    rows={3}
                    placeholder="Términos de pago y condiciones..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Observaciones</label>
                  <textarea
                    value={formData.observations || ''}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
                    rows={2}
                    placeholder="Errores de validación o envío..."
                    readOnly
                  />
                  <p className="text-xs text-slate-500 mt-1">Este campo se actualiza automáticamente cuando hay errores</p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition font-medium flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  {editingId ? 'Actualizar Factura' : 'Crear Factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Factura {selectedInvoice.invoice_number}</h2>
                  <p className="text-emerald-100 mt-1">Detalles completos de la factura</p>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 mb-2">CLIENTE</h3>
                  <p className="text-lg font-bold text-slate-900">
                    {selectedInvoice.clients?.company_name || selectedInvoice.clients?.contact_name}
                  </p>
                  <p className="text-slate-600">{selectedInvoice.clients?.email}</p>
                  {selectedInvoice.clients?.phone && (
                    <p className="text-slate-600">{selectedInvoice.clients.phone}</p>
                  )}
                  {selectedInvoice.clients?.address && (
                    <p className="text-slate-600 mt-2">
                      {selectedInvoice.clients.address}
                      {selectedInvoice.clients.city && `, ${selectedInvoice.clients.city}`}
                      {selectedInvoice.clients.country && `, ${selectedInvoice.clients.country}`}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <div className="mb-4">
                    <span
                      className="px-4 py-2 rounded-full text-sm font-semibold border"
                      style={getStatusStyle(selectedInvoice.status)}
                    >
                      {getStatusLabel(selectedInvoice.status)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Fecha de Emisión:</span> {new Date(selectedInvoice.issue_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Vencimiento:</span> {new Date(selectedInvoice.due_date).toLocaleDateString()}
                    </p>
                    {selectedInvoice.order_id && selectedInvoice.orders && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Orden:</span> {selectedInvoice.orders.order_number}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Detalles de la Factura</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 text-sm font-semibold text-slate-700">Descripción</th>
                      <th className="text-center py-3 text-sm font-semibold text-slate-700">Cantidad</th>
                      <th className="text-right py-3 text-sm font-semibold text-slate-700">Precio Unit.</th>
                      <th className="text-right py-3 text-sm font-semibold text-slate-700">Desc.</th>
                      <th className="text-right py-3 text-sm font-semibold text-slate-700">IVA</th>
                      <th className="text-right py-3 text-sm font-semibold text-slate-700">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoiceItems.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 text-slate-900">{item.description}</td>
                        <td className="py-3 text-center text-slate-700">{item.quantity}</td>
                        <td className="py-3 text-right text-slate-700">${item.unit_price.toFixed(2)}</td>
                        <td className="py-3 text-right text-slate-700">{item.discount}%</td>
                        <td className="py-3 text-right text-slate-700">{item.tax_rate}%</td>
                        <td className="py-3 text-right font-semibold text-slate-900">${item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-slate-200 pt-6">
                <div className="w-96 space-y-3">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Descuento:</span>
                    <span className="font-semibold text-red-600">-${selectedInvoice.discount_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>IVA:</span>
                    <span className="font-semibold">${selectedInvoice.tax_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-bold text-emerald-600 pt-3 border-t-2 border-emerald-200">
                    <span>TOTAL:</span>
                    <span>${selectedInvoice.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {(selectedInvoice.notes || selectedInvoice.terms) && (
                <div className="border-t border-slate-200 pt-6 space-y-4">
                  {selectedInvoice.notes && (
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">Notas:</h4>
                      <p className="text-slate-700">{selectedInvoice.notes}</p>
                    </div>
                  )}
                  {selectedInvoice.terms && (
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">Términos y Condiciones:</h4>
                      <p className="text-slate-700">{selectedInvoice.terms}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cerrar
                </button>
                <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-medium flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Descargar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
