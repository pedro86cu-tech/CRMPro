import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Mail, Send, Inbox as InboxIcon, Plus, Ticket, Star, Archive, Trash2,
  Reply, Forward, RefreshCw, Search, Paperclip, MoreHorizontal, Check,
  X, Tag, Folder, Clock, Flag, Download, Eye, AlertCircle, Settings, Save
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface InboxEmail {
  id: string;
  account_id: string;
  message_id: string;
  thread_id: string | null;
  from_email: string;
  from_name: string;
  to_emails: Array<{ email: string; name?: string }>;
  cc_emails: Array<{ email: string; name?: string }>;
  subject: string;
  body_text: string;
  body_html: string;
  attachments: Array<{ filename: string; size: number; type: string; url?: string }>;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  folder: string;
  labels: string[];
  email_date: string;
  created_at: string;
}

interface EmailDraft {
  id?: string;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  subject: string;
  body_html: string;
  reply_to_id?: string;
  forward_from_id?: string;
}

export function InboxModule() {
  const { user } = useAuth();
  const toast = useToast();
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'drafts' | 'starred' | 'archived' | 'trash'>('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasEmailAccount, setHasEmailAccount] = useState(false);

  const [composeData, setComposeData] = useState<EmailDraft>({
    to_emails: [],
    cc_emails: [],
    bcc_emails: [],
    subject: '',
    body_html: ''
  });

  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'forward'>('new');
  const [showCreateTicket, setShowCreateTicket] = useState(false);

  useEffect(() => {
    checkEmailAccount();
    loadEmails();
  }, [activeFolder]);

  const checkEmailAccount = async () => {
    if (!user?.id) return;

    console.log('[INBOX] Checking email account for user:', user.id);

    const { data, error } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('created_by', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[INBOX] Error checking email account:', error);
    } else {
      console.log('[INBOX] Email account found:', !!data);
    }

    setHasEmailAccount(!!data);
  };

  const loadEmails = async () => {
    if (!user?.id) return;

    console.log('[INBOX] Loading emails for folder:', activeFolder);
    setLoading(true);
    try {
      const { data: account } = await supabase
        .from('email_accounts')
        .select('id')
        .eq('created_by', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!account) {
        console.log('[INBOX] No email account found');
        setEmails([]);
        setLoading(false);
        return;
      }

      console.log('[INBOX] Using account ID:', account.id);

      let query = supabase
        .from('inbox_emails')
        .select('*')
        .eq('account_id', account.id)
        .order('email_date', { ascending: false });

      if (activeFolder === 'inbox') {
        query = query.eq('folder', 'inbox').eq('is_deleted', false).eq('is_archived', false);
      } else if (activeFolder === 'sent') {
        query = query.eq('folder', 'sent').eq('is_deleted', false);
      } else if (activeFolder === 'drafts') {
        query = query.eq('folder', 'drafts');
      } else if (activeFolder === 'starred') {
        query = query.eq('is_starred', true).eq('is_deleted', false);
      } else if (activeFolder === 'archived') {
        query = query.eq('is_archived', true).eq('is_deleted', false);
      } else if (activeFolder === 'trash') {
        query = query.eq('is_deleted', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[INBOX] Error loading emails:', error);
        throw error;
      }

      console.log(`[INBOX] Loaded ${data?.length || 0} emails for folder ${activeFolder}`);
      setEmails(data || []);
    } catch (error: any) {
      toast.error(`Error al cargar emails: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncEmails = async () => {
    if (!user?.id) return;

    console.log('[INBOX] Starting email sync');
    toast.info('Sincronizando emails...');
    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      console.log('[INBOX] Calling sync-inbox-emails function');

      const response = await fetch(`${supabaseUrl}/functions/v1/sync-inbox-emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });

      const result = await response.json();
      console.log('[INBOX] Sync result:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Error al sincronizar');
      }

      await loadEmails();
      toast.success(result.message || 'Emails sincronizados correctamente');
    } catch (error: any) {
      console.error('[INBOX] Sync error:', error);
      toast.error(`Error al sincronizar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (emailId: string, isRead: boolean) => {
    const { error } = await supabase
      .from('inbox_emails')
      .update({ is_read: isRead })
      .eq('id', emailId);

    if (!error) {
      loadEmails();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, is_read: isRead });
      }
    }
  };

  const handleToggleStar = async (emailId: string, isStarred: boolean) => {
    const { error } = await supabase
      .from('inbox_emails')
      .update({ is_starred: !isStarred })
      .eq('id', emailId);

    if (!error) {
      loadEmails();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, is_starred: !isStarred });
      }
    }
  };

  const handleArchive = async (emailId: string) => {
    const { error } = await supabase
      .from('inbox_emails')
      .update({ is_archived: true })
      .eq('id', emailId);

    if (!error) {
      toast.success('Email archivado');
      loadEmails();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }
    }
  };

  const handleDelete = async (emailId: string) => {
    const { error } = await supabase
      .from('inbox_emails')
      .update({ is_deleted: true })
      .eq('id', emailId);

    if (!error) {
      toast.success('Email movido a papelera');
      loadEmails();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }
    }
  };

  const handleReply = (email: InboxEmail) => {
    setComposeMode('reply');
    setComposeData({
      to_emails: [email.from_email],
      cc_emails: [],
      bcc_emails: [],
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body_html: `<br><br><div style="border-left: 3px solid #ccc; padding-left: 10px; margin-top: 20px;"><p><strong>De:</strong> ${email.from_name || email.from_email}</p><p><strong>Fecha:</strong> ${new Date(email.email_date).toLocaleString()}</p><p><strong>Asunto:</strong> ${email.subject}</p><br>${email.body_html || email.body_text}</div>`,
      reply_to_id: email.id
    });
    setToInput(email.from_email);
    setShowCompose(true);
  };

  const handleForward = (email: InboxEmail) => {
    setComposeMode('forward');
    setComposeData({
      to_emails: [],
      cc_emails: [],
      bcc_emails: [],
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body_html: `<br><br><div style="border-left: 3px solid #ccc; padding-left: 10px; margin-top: 20px;"><p><strong>---------- Forwarded message ---------</strong></p><p><strong>De:</strong> ${email.from_name || email.from_email}</p><p><strong>Fecha:</strong> ${new Date(email.email_date).toLocaleString()}</p><p><strong>Asunto:</strong> ${email.subject}</p><p><strong>Para:</strong> ${email.to_emails.map(t => t.email).join(', ')}</p><br>${email.body_html || email.body_text}</div>`,
      forward_from_id: email.id
    });
    setToInput('');
    setShowCompose(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) return;

    if (composeData.to_emails.length === 0 && toInput) {
      composeData.to_emails = toInput.split(',').map(e => e.trim()).filter(e => e);
    }
    if (composeData.cc_emails.length === 0 && ccInput) {
      composeData.cc_emails = ccInput.split(',').map(e => e.trim()).filter(e => e);
    }
    if (composeData.bcc_emails.length === 0 && bccInput) {
      composeData.bcc_emails = bccInput.split(',').map(e => e.trim()).filter(e => e);
    }

    if (composeData.to_emails.length === 0) {
      toast.error('Debes ingresar al menos un destinatario');
      return;
    }

    console.log('[INBOX] Sending email:', {
      to: composeData.to_emails,
      subject: composeData.subject
    });

    toast.info('Enviando email...');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      console.log('[INBOX] Calling send-inbox-email function');

      const response = await fetch(`${supabaseUrl}/functions/v1/send-inbox-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          to_emails: composeData.to_emails,
          cc_emails: composeData.cc_emails,
          bcc_emails: composeData.bcc_emails,
          subject: composeData.subject,
          body_html: composeData.body_html,
          body_text: composeData.body_html.replace(/<[^>]*>/g, ''),
          reply_to_id: composeData.reply_to_id,
          forward_from_id: composeData.forward_from_id
        })
      });

      const result = await response.json();
      console.log('[INBOX] Send result:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar email');
      }

      toast.success(result.message || 'Email enviado correctamente');
      setShowCompose(false);
      resetCompose();
      await loadEmails();
    } catch (error: any) {
      console.error('[INBOX] Send error:', error);
      toast.error(`Error al enviar: ${error.message}`);
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.id) return;

    try {
      const { data: account } = await supabase
        .from('email_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!account) {
        toast.error('No tienes una cuenta de correo configurada');
        return;
      }

      console.log('[INBOX] Saving draft');

      const draftData = {
        account_id: account.id,
        to_emails: composeData.to_emails,
        cc_emails: composeData.cc_emails,
        bcc_emails: composeData.bcc_emails,
        subject: composeData.subject,
        body_html: composeData.body_html,
        in_reply_to: composeData.reply_to_id,
        created_by: user.id
      };

      const { error } = await supabase
        .from('email_drafts')
        .insert(draftData);

      if (error) {
        console.error('[INBOX] Error saving draft:', error);
        throw error;
      }

      console.log('[INBOX] Draft saved successfully');
      toast.success('Borrador guardado');
      setShowCompose(false);
      resetCompose();
    } catch (error: any) {
      toast.error(`Error al guardar borrador: ${error.message}`);
    }
  };

  const resetCompose = () => {
    setComposeData({
      to_emails: [],
      cc_emails: [],
      bcc_emails: [],
      subject: '',
      body_html: ''
    });
    setToInput('');
    setCcInput('');
    setBccInput('');
    setShowCc(false);
    setShowBcc(false);
    setComposeMode('new');
  };

  const handleCreateTicket = async () => {
    if (!selectedEmail) return;

    try {
      const ticketNumber = `TK-${Date.now()}`;
      const { error } = await supabase.from('tickets').insert({
        ticket_number: ticketNumber,
        subject: selectedEmail.subject,
        description: selectedEmail.body_text || selectedEmail.body_html,
        status: 'open',
        priority: 'medium',
        created_by: user?.id
      });

      if (error) throw error;

      toast.success(`Ticket ${ticketNumber} creado exitosamente`);
      setShowCreateTicket(false);
    } catch (error: any) {
      toast.error(`Error al crear ticket: ${error.message}`);
    }
  };

  const filteredEmails = emails.filter(email => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      email.subject.toLowerCase().includes(search) ||
      email.from_email.toLowerCase().includes(search) ||
      email.from_name.toLowerCase().includes(search) ||
      email.body_text.toLowerCase().includes(search)
    );
  });

  const unreadCount = emails.filter(e => !e.is_read && !e.is_deleted).length;

  if (!hasEmailAccount) {
    return (
      <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
            <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings className="w-10 h-10 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Configura tu Buzón de Correo</h2>
            <p className="text-slate-600 mb-6">
              Para usar el buzón de correos, primero debes configurar tu cuenta de email en la sección de Configuración.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 text-left">
                  <p className="font-semibold mb-1">Pasos para configurar:</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700">
                    <li>Ve a la sección "Configuración"</li>
                    <li>Selecciona la pestaña "Buzón Personal"</li>
                    <li>Ingresa los datos de tu cuenta de correo (IMAP/SMTP)</li>
                    <li>Guarda la configuración</li>
                    <li>Regresa aquí para gestionar tus emails</li>
                  </ol>
                </div>
              </div>
            </div>
            <button
              onClick={() => window.location.hash = '#settings'}
              className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-3 rounded-lg hover:from-orange-700 hover:to-orange-600 transition shadow-lg"
            >
              Ir a Configuración
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={() => {
              setShowCompose(true);
              setComposeMode('new');
              resetCompose();
            }}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-3 rounded-lg hover:from-blue-700 hover:to-blue-600 transition shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Nuevo Email</span>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => setActiveFolder('inbox')}
            className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'inbox'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <InboxIcon className="w-5 h-5" />
              <span>Bandeja de entrada</span>
            </div>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFolder('starred')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'starred'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Star className="w-5 h-5" />
            <span>Destacados</span>
          </button>

          <button
            onClick={() => setActiveFolder('sent')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'sent'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Send className="w-5 h-5" />
            <span>Enviados</span>
          </button>

          <button
            onClick={() => setActiveFolder('drafts')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'drafts'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Mail className="w-5 h-5" />
            <span>Borradores</span>
          </button>

          <button
            onClick={() => setActiveFolder('archived')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'archived'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Archive className="w-5 h-5" />
            <span>Archivados</span>
          </button>

          <button
            onClick={() => setActiveFolder('trash')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'trash'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Trash2 className="w-5 h-5" />
            <span>Papelera</span>
          </button>
        </nav>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar en el buzón..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSyncEmails}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-96 bg-white border-r border-slate-200 overflow-y-auto">
            {loading && emails.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                  <p>Cargando emails...</p>
                </div>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center p-8">
                  <InboxIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium mb-2">No hay emails</p>
                  <p className="text-sm">Esta carpeta está vacía</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredEmails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => {
                      setSelectedEmail(email);
                      if (!email.is_read) {
                        handleMarkAsRead(email.id, true);
                      }
                    }}
                    className={`p-4 cursor-pointer transition ${
                      selectedEmail?.id === email.id
                        ? 'bg-blue-50 border-l-4 border-blue-600'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    } ${!email.is_read ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(email.id, email.is_starred);
                          }}
                          className="flex-shrink-0"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              email.is_starred
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-slate-300 hover:text-yellow-400'
                            }`}
                          />
                        </button>
                        <p
                          className={`text-sm truncate ${
                            !email.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                          }`}
                        >
                          {email.from_name || email.from_email}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                        {new Date(email.email_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p
                      className={`text-sm mb-1 truncate ${
                        !email.is_read ? 'font-semibold text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {email.subject || '(Sin asunto)'}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2">{email.body_text}</p>
                    {email.attachments && email.attachments.length > 0 && (
                      <div className="flex items-center space-x-1 mt-2">
                        <Paperclip className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          {email.attachments.length} adjunto(s)
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 bg-white overflow-y-auto">
            {selectedEmail ? (
              <div className="h-full flex flex-col">
                <div className="border-b border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h2 className="text-2xl font-bold text-slate-900 flex-1">
                      {selectedEmail.subject || '(Sin asunto)'}
                    </h2>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleReply(selectedEmail)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        title="Responder"
                      >
                        <Reply className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleForward(selectedEmail)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        title="Reenviar"
                      >
                        <Forward className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleArchive(selectedEmail.id)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        title="Archivar"
                      >
                        <Archive className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(selectedEmail.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowCreateTicket(true)}
                        className="flex items-center space-x-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                      >
                        <Ticket className="w-4 h-4" />
                        <span className="text-sm font-medium">Crear Ticket</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-slate-700">De:</span>
                      <span className="text-slate-900">
                        {selectedEmail.from_name ? `${selectedEmail.from_name} <${selectedEmail.from_email}>` : selectedEmail.from_email}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-slate-700">Para:</span>
                      <span className="text-slate-900">
                        {selectedEmail.to_emails.map((t: any) => t.email || t).join(', ')}
                      </span>
                    </div>
                    {selectedEmail.cc_emails && selectedEmail.cc_emails.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-slate-700">CC:</span>
                        <span className="text-slate-900">
                          {selectedEmail.cc_emails.map((t: any) => t.email || t).join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(selectedEmail.email_date).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                  {selectedEmail.body_html ? (
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                    />
                  ) : (
                    <p className="text-slate-700 whitespace-pre-wrap">{selectedEmail.body_text}</p>
                  )}

                  {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                        <Paperclip className="w-4 h-4" />
                        <span>Adjuntos ({selectedEmail.attachments.length})</span>
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedEmail.attachments.map((attachment: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition"
                          >
                            <Paperclip className="w-5 h-5 text-slate-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {attachment.filename}
                              </p>
                              <p className="text-xs text-slate-500">
                                {(attachment.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <button className="p-1 text-blue-600 hover:text-blue-700">
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Mail className="w-20 h-20 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium mb-2">Selecciona un email</p>
                  <p className="text-sm">Elige un mensaje para ver su contenido</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {composeMode === 'reply' ? 'Responder' : composeMode === 'forward' ? 'Reenviar' : 'Nuevo Mensaje'}
              </h2>
              <button
                onClick={() => {
                  setShowCompose(false);
                  resetCompose();
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <label className="text-sm font-medium text-slate-700 w-16">Para:</label>
                    <input
                      type="text"
                      value={toInput}
                      onChange={(e) => setToInput(e.target.value)}
                      placeholder="destinatario@ejemplo.com"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCc(!showCc)}
                      className="text-sm text-blue-600 hover:text-blue-700 px-2"
                    >
                      Cc
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBcc(!showBcc)}
                      className="text-sm text-blue-600 hover:text-blue-700 px-2"
                    >
                      Bcc
                    </button>
                  </div>
                  {showCc && (
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="text-sm font-medium text-slate-700 w-16">Cc:</label>
                      <input
                        type="text"
                        value={ccInput}
                        onChange={(e) => setCcInput(e.target.value)}
                        placeholder="copia@ejemplo.com"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                  {showBcc && (
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="text-sm font-medium text-slate-700 w-16">Bcc:</label>
                      <input
                        type="text"
                        value={bccInput}
                        onChange={(e) => setBccInput(e.target.value)}
                        placeholder="copia-oculta@ejemplo.com"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-slate-700 w-16">Asunto:</label>
                  <input
                    type="text"
                    value={composeData.subject}
                    onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                    placeholder="Asunto del mensaje"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <textarea
                    value={composeData.body_html}
                    onChange={(e) => setComposeData({ ...composeData, body_html: e.target.value })}
                    rows={15}
                    placeholder="Escribe tu mensaje aquí..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-6 border-t border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex items-center space-x-2 px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Borrador</span>
                </button>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompose(false);
                      resetCompose();
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-blue-600 transition shadow-lg"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateTicket && selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-green-100 p-3 rounded-lg">
                <Ticket className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Crear Ticket desde Email</h2>
                <p className="text-slate-600">Convertir este email en un ticket de soporte</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-slate-700 mb-2">Vista previa:</p>
              <p className="text-sm text-slate-600 mb-1">
                <strong>Asunto:</strong> {selectedEmail.subject}
              </p>
              <p className="text-sm text-slate-600 mb-1">
                <strong>De:</strong> {selectedEmail.from_email}
              </p>
              <p className="text-sm text-slate-600 line-clamp-3">
                <strong>Mensaje:</strong> {selectedEmail.body_text}
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateTicket(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTicket}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-2 rounded-lg hover:from-green-700 hover:to-green-600 transition shadow-lg"
              >
                <Check className="w-5 h-5" />
                <span>Crear Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
