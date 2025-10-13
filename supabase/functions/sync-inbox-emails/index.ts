import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { ImapFlow } from 'npm:imapflow@1.0.162';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-User-Token, X-User-Id',
};

interface EmailAccount {
  id: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_password: string;
  use_ssl: boolean;
  is_active: boolean;
}

async function tryImapConnection(config: any): Promise<ImapFlow> {
  const client = new ImapFlow(config);
  await client.connect();
  return client;
}

async function fetchEmailsFromIMAP(account: EmailAccount, userId: string, supabase: any): Promise<number> {
  console.log(`[SYNC-INBOX] Connecting to IMAP: ${account.imap_host}:${account.imap_port}`);
  console.log(`[SYNC-INBOX] SSL/TLS enabled: ${account.use_ssl}`);
  console.log(`[SYNC-INBOX] Username: ${account.imap_username}`);
  console.log(`[SYNC-INBOX] Password length: ${account.imap_password?.length || 0}`);

  const baseConfig = {
    host: account.imap_host,
    auth: {
      user: account.imap_username,
      pass: account.imap_password,
    },
    logger: {
      debug: (obj: any) => console.log('[IMAP-DEBUG]', obj.msg || obj),
      info: (obj: any) => console.log('[IMAP-INFO]', obj.msg || obj),
      warn: (obj: any) => console.warn('[IMAP-WARN]', obj.msg || obj),
      error: (obj: any) => console.error('[IMAP-ERROR]', obj.msg || obj),
    },
  };

  const configs = [
    {
      ...baseConfig,
      port: 143,
      secure: false,
      requireTLS: true,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
      },
      greetingTimeout: 30000,
      socketTimeout: 60000,
      connectionTimeout: 60000,
      disableAutoIdle: true,
      name: 'STARTTLS puerto 143 (timeout extendido)'
    },
    {
      ...baseConfig,
      port: 993,
      secure: false,
      requireTLS: true,
      tls: {
        rejectUnauthorized: false,
      },
      greetingTimeout: 30000,
      socketTimeout: 60000,
      connectionTimeout: 60000,
      disableAutoIdle: true,
      name: 'STARTTLS puerto 993'
    },
    {
      ...baseConfig,
      port: account.imap_port,
      secure: account.use_ssl,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
        ciphers: 'ALL',
      },
      greetingTimeout: 30000,
      socketTimeout: 60000,
      disableAutoIdle: true,
      name: 'SSL directo con timeouts extendidos'
    },
  ];

  let client: ImapFlow | null = null;
  let lastError: any = null;

  for (const config of configs) {
    try {
      console.log(`[SYNC-INBOX] Intentando: ${config.name}`);
      console.log(`[SYNC-INBOX] Puerto: ${config.port}, Secure: ${config.secure}, RequireTLS: ${config.requireTLS || false}`);
      console.log(`[SYNC-INBOX] Timeouts - Greeting: ${config.greetingTimeout || 'default'}, Socket: ${config.socketTimeout || 'default'}`);
      client = await tryImapConnection(config);
      console.log(`[SYNC-INBOX] Conexion exitosa con: ${config.name}`);
      break;
    } catch (error) {
      console.error(`[SYNC-INBOX] Fallo ${config.name}:`, error.message);
      console.error(`[SYNC-INBOX] Error code:`, error.code);
      lastError = error;
      client = null;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!client) {
    throw new Error(`No se pudo conectar con ninguna configuracion. Ultimo error: ${lastError?.message}`);
  }

  let syncedCount = 0;

  try {
    console.log('[SYNC-INBOX] Connection state:', client.authenticated ? 'authenticated' : 'not authenticated');

    const lock = await client.getMailboxLock('INBOX');
    console.log(`[SYNC-INBOX] INBOX opened. Total messages: ${client.mailbox.exists}`);

    try {
      if (client.mailbox.exists === 0) {
        console.log('[SYNC-INBOX] No messages in INBOX');
        return 0;
      }

      const fetchCount = Math.min(50, client.mailbox.exists);
      const startSeq = Math.max(1, client.mailbox.exists - fetchCount + 1);
      console.log(`[SYNC-INBOX] Fetching last ${fetchCount} messages (${startSeq}:${client.mailbox.exists})`);

      for await (const message of client.fetch(`${startSeq}:*`, {
        envelope: true,
        bodyStructure: true,
        source: true,
        uid: true,
      })) {
        try {
          const messageId = message.envelope?.messageId || `${message.uid}-${Date.now()}`;

          const { data: existingEmail } = await supabase
            .from('inbox_emails')
            .select('id')
            .eq('message_id', messageId)
            .eq('account_id', account.id)
            .maybeSingle();

          if (existingEmail) {
            console.log(`[SYNC-INBOX] Message ${messageId} already exists, skipping`);
            continue;
          }

          const from = message.envelope?.from?.[0];
          const to = message.envelope?.to?.[0];

          const emailData = {
            account_id: account.id,
            user_id: userId,
            message_id: messageId,
            subject: message.envelope?.subject || '(Sin asunto)',
            from_email: from?.address || 'unknown',
            from_name: from?.name || from?.address || 'Unknown',
            to_email: to?.address || account.email_address,
            to_name: to?.name || '',
            received_at: message.envelope?.date || new Date().toISOString(),
            body_text: message.source?.toString() || '',
            body_html: message.source?.toString() || '',
            is_read: message.flags?.has('\\Seen') || false,
            is_starred: message.flags?.has('\\Flagged') || false,
            has_attachments: false,
            folder: 'INBOX',
            uid: message.uid.toString(),
          };

          const { error: insertError } = await supabase
            .from('inbox_emails')
            .insert(emailData);

          if (insertError) {
            console.error(`[SYNC-INBOX] Error inserting email ${messageId}:`, insertError);
          } else {
            syncedCount++;
            console.log(`[SYNC-INBOX] Synced email: ${emailData.subject}`);
          }
        } catch (msgError) {
          console.error('[SYNC-INBOX] Error processing message:', msgError);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    console.log(`[SYNC-INBOX] Logged out. Total emails synced: ${syncedCount}`);

  } catch (error) {
    console.error('[SYNC-INBOX] IMAP error:', error.message);

    try {
      if (client && client.usable) {
        await client.logout();
      }
    } catch (e) {
      console.error('[SYNC-INBOX] Error during logout:', e.message);
    }

    throw new Error(`IMAP error: ${error.message}`);
  }

  return syncedCount;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const userId = req.headers.get('X-User-Id');
    if (!userId) {
      throw new Error('Missing user ID header');
    }

    console.log(`[SYNC-INBOX] Syncing emails for user: ${userId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('created_by', userId)
      .eq('is_active', true);

    if (accountsError) {
      throw accountsError;
    }

    console.log(`[SYNC-INBOX] Accounts found: ${accounts?.length || 0}`);

    let totalSynced = 0;
    const errors: string[] = [];

    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
        try {
          console.log(`[SYNC-INBOX] Processing account: ${account.email_address}`);
          const synced = await fetchEmailsFromIMAP(account, userId, supabase);
          totalSynced += synced;
        } catch (error) {
          const errorMsg = `Error syncing account ${account.email_address}: ${error.message}`;
          console.error(`[SYNC-INBOX] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`[SYNC-INBOX] ========== SYNC COMPLETED ==========`);
    console.log(`[SYNC-INBOX] Total emails synced: ${totalSynced}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalSynced,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[SYNC-INBOX] IMAP error:', error.message);
    console.error('[SYNC-INBOX] Full error:', JSON.stringify(error, null, 2));
    console.error('[SYNC-INBOX] Error name:', error.name);
    console.error('[SYNC-INBOX] Error code:', error.code);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: {
          name: error.name,
          code: error.code,
        },
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
