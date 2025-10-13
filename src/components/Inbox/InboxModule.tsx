import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Send, Inbox as InboxIcon, Plus, Ticket } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';

interface Email {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  is_read: boolean;
  direction: 'inbound' | 'outbound';
  created_at: string;
  clients?: { company_name: string };
}

export function InboxModule() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [filter, setFilter] = useState<'all' | 'inbound' | 'outbound'>('all');

  const [composeData, setComposeData] = useState({
    to_email: '',
    subject: '',
    body: ''
  });

  useEffect(() => {
    const initialize = async () => {
      await ensureCurrentUserInSystemUsers();
      loadEmails();
    };
    initialize();
  }, []);

  const loadEmails = async () => {
    const { data } = await supabase
      .from('emails')
      .select('*, clients(company_name)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    if (data) setEmails(data);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    await ensureCurrentUserInSystemUsers();
    const { error } = await supabase.from('emails').insert({
      ...composeData,
      from_email: user?.email || 'tu-email@crm.com',
      direction: 'outbound',
      is_read: true,
      user_id: user?.id
    });

    if (!error) {
      loadEmails();
      setComposeData({ to_email: '', subject: '', body: '' });
      setShowCompose(false);
    }
  };

  const handleMarkAsRead = async (emailId: string) => {
    await supabase.from('emails').update({ is_read: true }).eq('id', emailId);
    loadEmails();
  };

  const handleCreateTicket = async (email: Email) => {
    const ticketNumber = `TK-${Date.now()}`;
    const { error } = await supabase.from('tickets').insert({
      ticket_number: ticketNumber,
      client_id: email.clients ? null : null,
      subject: email.subject,
      description: email.body,
      status: 'open',
      priority: 'medium',
      created_by: null
    });

    if (!error) {
      alert('Ticket creado exitosamente');
    }
  };

  const handleReply = (email: Email) => {
    setComposeData({
      to_email: email.from_email,
      subject: `Re: ${email.subject}`,
      body: `\n\n--- Original Message ---\n${email.body}`
    });
    setShowCompose(true);
  };

  const filteredEmails = emails.filter(email => {
    if (filter === 'all') return true;
    return email.direction === filter;
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Buzón de Correos</h1>
          <p className="text-slate-600 mt-1">Gestiona tu comunicación por email</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Email</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('inbound')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'inbound' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Recibidos
          </button>
          <button
            onClick={() => setFilter('outbound')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'outbound' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Enviados
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Mensajes</h2>
          </div>
          <div className="divide-y divide-slate-200 max-h-[600px] overflow-y-auto">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                onClick={() => {
                  setSelectedEmail(email);
                  if (!email.is_read && email.direction === 'inbound') {
                    handleMarkAsRead(email.id);
                  }
                }}
                className={`p-4 cursor-pointer hover:bg-slate-50 transition ${
                  selectedEmail?.id === email.id ? 'bg-blue-50' : ''
                } ${!email.is_read && email.direction === 'inbound' ? 'bg-blue-50/30' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {email.direction === 'inbound' ? (
                      <InboxIcon className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Send className="w-4 h-4 text-green-600" />
                    )}
                    <p className={`text-sm ${!email.is_read && email.direction === 'inbound' ? 'font-bold' : 'font-medium'} text-slate-900 line-clamp-1`}>
                      {email.direction === 'inbound' ? email.from_email : email.to_email}
                    </p>
                  </div>
                  {!email.is_read && email.direction === 'inbound' && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}
                </div>
                <p className={`text-sm ${!email.is_read && email.direction === 'inbound' ? 'font-semibold' : ''} text-slate-700 line-clamp-1 mb-1`}>
                  {email.subject}
                </p>
                <p className="text-xs text-slate-500 line-clamp-2 mb-2">{email.body}</p>
                <p className="text-xs text-slate-400">{new Date(email.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200">
          {selectedEmail ? (
            <>
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedEmail.subject}</h2>
                    <div className="flex items-center space-x-4 text-sm text-slate-600">
                      <span className="flex items-center space-x-1">
                        <span className="font-medium">De:</span>
                        <span>{selectedEmail.from_email}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <span className="font-medium">Para:</span>
                        <span>{selectedEmail.to_email}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(selectedEmail.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {selectedEmail.direction === 'inbound' && (
                      <>
                        <button
                          onClick={() => handleReply(selectedEmail)}
                          className="px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded-lg hover:bg-blue-200 transition"
                        >
                          Responder
                        </button>
                        <button
                          onClick={() => handleCreateTicket(selectedEmail)}
                          className="px-3 py-2 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200 transition flex items-center space-x-1"
                        >
                          <Ticket className="w-4 h-4" />
                          <span>Crear Ticket</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="prose max-w-none">
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedEmail.body}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p>Selecciona un email para ver su contenido</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Nuevo Email</h2>

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Para</label>
                <input
                  type="email"
                  value={composeData.to_email}
                  onChange={(e) => setComposeData({ ...composeData, to_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Asunto</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mensaje</label>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCompose(false);
                    setComposeData({ to_email: '', subject: '', body: '' });
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
