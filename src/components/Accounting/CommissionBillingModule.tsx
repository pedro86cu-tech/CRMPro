import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import {
  DollarSign,
  FileText,
  Users,
  CheckCircle,
  AlertCircle,
  X,
  Send,
  Plus,
  Edit,
  Save
} from 'lucide-react';

interface Partner {
  id: string;
  external_id: string;
  name: string;
  company_name: string;
  rut: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  is_active: boolean;
}

interface PendingInvoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  issue_date: string;
  status: string;
  partner_id: string;
  partner_name: string;
  commission_amount: number;
  order_id: string;
}

interface CommissionGroup {
  partner_id: string;
  partner_name: string;
  partner: Partner | null;
  invoices: PendingInvoice[];
  total_commission: number;
  iva_amount: number;
  total_with_iva: number;
}

export function CommissionBillingModule() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [commissionGroups, setCommissionGroups] = useState<CommissionGroup[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<CommissionGroup | null>(null);
  const [ivaRate, setIvaRate] = useState(22);
  const [processing, setProcessing] = useState(false);
  const toast = useToast();

  const [partnerForm, setPartnerForm] = useState<Partial<Partner>>({
    name: '',
    company_name: '',
    rut: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Uruguay',
    is_active: true
  });

  useEffect(() => {
    fetchPartners();
    fetchPendingInvoices();
  }, []);

  useEffect(() => {
    groupInvoicesByPartner();
  }, [pendingInvoices, partners, ivaRate]);

  const fetchPartners = async () => {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setPartners(data);
    }
  };

  const fetchPendingInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        orders!inner(
          external_partner_id,
          commission_amount,
          metadata
        )
      `)
      .eq('commission_billed', false)
      .eq('status', 'sent')
      .not('orders.external_partner_id', 'is', null)
      .not('orders.commission_amount', 'is', null)
      .gt('orders.commission_amount', 0);

    if (!error && data) {
      const invoices: PendingInvoice[] = data.map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        total_amount: inv.total_amount,
        issue_date: inv.issue_date,
        status: inv.status,
        partner_id: inv.orders.external_partner_id,
        partner_name: inv.orders.metadata?.items?.[0]?.partnerName || 'Partner',
        commission_amount: inv.orders.commission_amount || 0,
        order_id: inv.order_id
      }));
      setPendingInvoices(invoices);
    }
  };

  const groupInvoicesByPartner = () => {
    const groups = new Map<string, CommissionGroup>();

    pendingInvoices.forEach(invoice => {
      const partnerId = invoice.partner_id;
      const existingPartner = partners.find(p => p.external_id === partnerId);

      if (!groups.has(partnerId)) {
        groups.set(partnerId, {
          partner_id: partnerId,
          partner_name: invoice.partner_name,
          partner: existingPartner || null,
          invoices: [],
          total_commission: 0,
          iva_amount: 0,
          total_with_iva: 0
        });
      }

      const group = groups.get(partnerId)!;
      group.invoices.push(invoice);
      group.total_commission += invoice.commission_amount;
    });

    groups.forEach(group => {
      group.iva_amount = group.total_commission * (ivaRate / 100);
      group.total_with_iva = group.total_commission + group.iva_amount;
    });

    setCommissionGroups(Array.from(groups.values()));
  };

  const handleSavePartner = async () => {
    if (!partnerForm.name || !partnerForm.rut) {
      toast?.showToast('Complete los campos requeridos', 'error');
      return;
    }

    const { error } = selectedPartner
      ? await supabase
          .from('partners')
          .update(partnerForm)
          .eq('id', selectedPartner.id)
      : await supabase
          .from('partners')
          .insert(partnerForm);

    if (error) {
      toast?.showToast('Error guardando partner: ' + error.message, 'error');
      return;
    }

    toast?.showToast(`Partner ${selectedPartner ? 'actualizado' : 'creado'} exitosamente`, 'success');
    setShowPartnerModal(false);
    setSelectedPartner(null);
    setPartnerForm({
      name: '',
      company_name: '',
      rut: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      postal_code: '',
      country: 'Uruguay',
      is_active: true
    });
    fetchPartners();
  };

  const handleGenerateCommissionInvoice = async () => {
    if (!selectedGroup || !selectedGroup.partner) {
      toast?.showToast('El partner debe estar registrado con datos fiscales', 'error');
      return;
    }

    setProcessing(true);

    try {
      const partner = selectedGroup.partner;

      const invoiceNumber = `COM-${Date.now()}`;
      const subtotal = selectedGroup.total_commission;
      const taxAmount = selectedGroup.iva_amount;
      const totalAmount = selectedGroup.total_with_iva;

      const { data: partnerClient, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('rut', partner.rut)
        .maybeSingle();

      let clientId = partnerClient?.id;

      if (!clientId) {
        const { data: newClient, error: newClientError } = await supabase
          .from('clients')
          .insert({
            contact_name: partner.name,
            company_name: partner.company_name || partner.name,
            rut: partner.rut,
            email: partner.email,
            phone: partner.phone,
            address: partner.address,
            city: partner.city,
            country: partner.country,
            status: 'active',
            source: 'partner'
          })
          .select('id')
          .single();

        if (newClientError) {
          throw new Error('Error creando cliente: ' + newClientError.message);
        }
        clientId = newClient.id;
      }

      const { data: commissionInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          client_id: clientId,
          order_id: null,
          partner_id: partner.id,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subtotal: subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          currency: 'UYU',
          status: 'draft',
          is_commission_invoice: true,
          commission_iva_rate: ivaRate,
          notes: `Factura de comisiones - ${selectedGroup.invoices.length} facturas procesadas`,
          company_name: partner.company_name || partner.name,
          rut_emisor: '211234560018',
          serie_cfe: 'A'
        })
        .select()
        .single();

      if (invoiceError) {
        throw new Error('Error creando factura: ' + invoiceError.message);
      }

      const { error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: `COM-ORD-${Date.now()}`,
          client_id: clientId,
          status: 'completed',
          payment_status: 'unpaid',
          total_amount: totalAmount,
          subtotal: subtotal,
          tax_amount: taxAmount,
          tax_rate: ivaRate,
          currency: 'UYU',
          order_date: new Date().toISOString().split('T')[0],
          notes: `Orden para factura de comisiones ${invoiceNumber}`
        })
        .select('id')
        .single()
        .then(async ({ data: order }) => {
          if (order) {
            await supabase
              .from('invoices')
              .update({ order_id: order.id })
              .eq('id', commissionInvoice.id);

            await supabase
              .from('order_items')
              .insert({
                order_id: order.id,
                product_name: 'Comisión por ventas',
                description: `Comisiones de ${selectedGroup.invoices.length} facturas procesadas`,
                quantity: 1,
                unit_price: subtotal,
                line_total: subtotal,
                total_price: subtotal,
                tax_rate: ivaRate,
                item_type: 'service'
              });
          }
        });

      const invoiceIds = selectedGroup.invoices.map(inv => inv.id);
      await supabase
        .from('invoices')
        .update({
          commission_billed: true,
          commission_invoice_id: commissionInvoice.id
        })
        .in('id', invoiceIds);

      toast?.showToast(
        `Factura de comisión ${invoiceNumber} creada exitosamente`,
        'success'
      );

      setShowBillingModal(false);
      setSelectedGroup(null);
      fetchPendingInvoices();
    } catch (error: any) {
      toast?.showToast('Error generando factura: ' + error.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Facturación de Comisiones</h2>
          <p className="text-sm text-slate-600">Generar facturas de comisiones para partners</p>
        </div>
        <button
          onClick={() => {
            setSelectedPartner(null);
            setPartnerForm({
              name: '',
              company_name: '',
              rut: '',
              email: '',
              phone: '',
              address: '',
              city: '',
              postal_code: '',
              country: 'Uruguay',
              is_active: true
            });
            setShowPartnerModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
        >
          <Plus size={18} />
          <span>Nuevo Partner</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Tasa de IVA para Comisiones (%)
        </label>
        <input
          type="number"
          value={ivaRate}
          onChange={(e) => setIvaRate(Number(e.target.value))}
          className="w-32 border border-slate-300 rounded-lg px-3 py-2"
          min="0"
          max="100"
          step="0.1"
        />
      </div>

      <div className="grid gap-6">
        {commissionGroups.length === 0 ? (
          <div className="bg-slate-50 rounded-lg p-12 text-center">
            <FileText size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-600">No hay facturas pendientes de facturación de comisiones</p>
          </div>
        ) : (
          commissionGroups.map(group => (
            <div key={group.partner_id} className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <Users size={24} className="text-blue-600" />
                    <h3 className="text-lg font-semibold text-slate-900">{group.partner_name}</h3>
                  </div>
                  {group.partner ? (
                    <div className="text-sm text-slate-600 space-y-1">
                      <p><strong>RUT:</strong> {group.partner.rut}</p>
                      <p><strong>Razón Social:</strong> {group.partner.company_name}</p>
                      <p><strong>Email:</strong> {group.partner.email}</p>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-amber-600">
                      <AlertCircle size={16} />
                      <span className="text-sm">Partner sin datos fiscales</span>
                      <button
                        onClick={() => {
                          setPartnerForm({
                            external_id: group.partner_id,
                            name: group.partner_name,
                            company_name: '',
                            rut: '',
                            email: '',
                            phone: '',
                            address: '',
                            city: '',
                            postal_code: '',
                            country: 'Uruguay',
                            is_active: true
                          });
                          setShowPartnerModal(true);
                        }}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Registrar datos fiscales
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">Total Comisiones</p>
                  <p className="text-2xl font-bold text-slate-900">${group.total_commission.toFixed(2)}</p>
                  <p className="text-sm text-slate-600">IVA ({ivaRate}%): ${group.iva_amount.toFixed(2)}</p>
                  <p className="text-lg font-semibold text-green-600 mt-1">Total: ${group.total_with_iva.toFixed(2)}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 mb-4">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Facturas incluidas ({group.invoices.length})
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {group.invoices.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center text-sm bg-slate-50 rounded px-3 py-2">
                      <span className="font-medium">{inv.invoice_number}</span>
                      <span className="text-slate-600">{new Date(inv.issue_date).toLocaleDateString()}</span>
                      <span className="text-green-600 font-semibold">${inv.commission_amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!group.partner) {
                    toast?.showToast('Debe registrar los datos fiscales del partner primero', 'error');
                    return;
                  }
                  setSelectedGroup(group);
                  setShowBillingModal(true);
                }}
                disabled={!group.partner}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
                <span>Generar e-Factura de Comisiones</span>
              </button>
            </div>
          ))
        )}
      </div>

      {showPartnerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold">
                {selectedPartner ? 'Editar Partner' : 'Nuevo Partner'}
              </h3>
              <button onClick={() => setShowPartnerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={partnerForm.name}
                    onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    RUT *
                  </label>
                  <input
                    type="text"
                    value={partnerForm.rut}
                    onChange={(e) => setPartnerForm({ ...partnerForm, rut: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    value={partnerForm.company_name}
                    onChange={(e) => setPartnerForm({ ...partnerForm, company_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={partnerForm.email}
                    onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={partnerForm.phone}
                    onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={partnerForm.address}
                    onChange={(e) => setPartnerForm({ ...partnerForm, address: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={partnerForm.city}
                    onChange={(e) => setPartnerForm({ ...partnerForm, city: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    value={partnerForm.postal_code}
                    onChange={(e) => setPartnerForm({ ...partnerForm, postal_code: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowPartnerModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePartner}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
                >
                  <Save size={18} />
                  <span>Guardar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBillingModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold">Confirmar Facturación de Comisiones</h3>
              <button onClick={() => setShowBillingModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 mb-2">
                  Se generará una e-Factura de comisiones para:
                </p>
                <p className="font-semibold text-blue-900">{selectedGroup.partner_name}</p>
                <p className="text-sm text-blue-800">RUT: {selectedGroup.partner?.rut}</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Facturas procesadas:</span>
                  <span className="font-semibold">{selectedGroup.invoices.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal comisiones:</span>
                  <span className="font-semibold">${selectedGroup.total_commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">IVA ({ivaRate}%):</span>
                  <span className="font-semibold">${selectedGroup.iva_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-lg font-semibold text-slate-900">Total:</span>
                  <span className="text-lg font-bold text-green-600">${selectedGroup.total_with_iva.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900">
                  <strong>Nota:</strong> La factura se creará en estado "Borrador" y podrá ser enviada a DGI para validación desde el módulo de Facturas.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowBillingModal(false)}
                  disabled={processing}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerateCommissionInvoice}
                  disabled={processing}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center space-x-2 disabled:opacity-50"
                >
                  <CheckCircle size={18} />
                  <span>{processing ? 'Procesando...' : 'Generar Factura'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
