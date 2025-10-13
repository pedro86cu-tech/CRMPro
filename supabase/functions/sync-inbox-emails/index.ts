import { createClient } from 'npm:@supabase/supabase-js@2';
import { ImapFlow } from 'npm:imapflow@1.0.162';
import { simpleParser } from 'npm:mailparser@3.6.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailAccount {
  id: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_password: string;
  use_ssl: boolean;
}

async function fetchEmailsFromIMAP(account: EmailAccount, userId: string, supabase: any): Promise<number> {
  console.log(`[SYNC-INBOX] 📧 Connecting to IMAP: ${account.imap_host}:${account.imap_port}`);
  console.log(`[SYNC-INBOX] SSL/TLS enabled: ${account.use_ssl}`);
  console.log(`[SYNC-INBOX] Username: ${account.imap_username}`);
  console.log(`[SYNC-INBOX] Password length: ${account.imap_password?.length || 0}`);

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.use_ssl,
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
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1',
    },
    disableAutoIdle: true,
  });

  let syncedCount = 0;

  try {
    console.log('[SYNC-INBOX] Attempting connection...');
    await client.connect();
    console.log('[SYNC-INBOX] ✓ IMAP connection established');
    console.log('[SYNC-INBOX] Connection state:', client.authenticated ? 'authenticated' : 'not authenticated');

    const lock = await client.getMailboxLock('INBOX');
    console.log(`[SYNC-INBOX] ✓ INBOX opened. Total messages: ${client.mailbox.exists}`);

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
      })) {
        try {
          console.log(`[SYNC-INBOX] Processing message #${message.seq}`);

          const parsed = await simpleParser(message.source);

          const messageId = parsed.messageId || `<generated-${Date.now()}-${message.seq}@${account.email_address.split('@')[1]}>`;

          console.log(`[SYNC-INBOX] Subject: ${parsed.subject || '(no subject)'}`);
          console.log(`[SYNC-INBOX] Message ID: ${messageId}`);

          const { data: existing } = await supabase
            .from('inbox_emails')
            .select('id')
            .eq('message_id', messageId)
            .maybeSingle();

          if (existing) {
            console.log(`[SYNC-INBOX] ⊘ Message already exists, skipping`);
            continue;
          }

          const attachments = parsed.attachments?.map(att => ({
            filename: att.filename || 'unnamed',
            size: att.size || 0,
            type: att.contentType || 'application/octet-stream',
            content: att.content ? att.content.toString('base64') : null,
          })) || [];

          console.log(`[SYNC-INBOX] Attachments: ${attachments.length}`);

          const emailData = {
            account_id: account.id,
            user_id: userId,
            message_id: messageId,
            thread_id: parsed.inReplyTo || null,
            from_email: parsed.from?.value?.[0]?.address || '',
            from_name: parsed.from?.value?.[0]?.name || '',
            to_emails: parsed.to?.value?.map(t => ({ email: t.address, name: t.name })) || [],
            cc_emails: parsed.cc?.value?.map(t => ({ email: t.address, name: t.name })) || [],
            bcc_emails: [],
            subject: parsed.subject || '(Sin asunto)',
            body_text: parsed.text || '',
            body_html: parsed.html || parsed.textAsHtml || '',
            attachments: attachments,
            is_read: false,
            is_starred: false,
            is_archived: false,
            is_deleted: false,
            folder: 'inbox',
            labels: [],
            email_date: parsed.date?.toISOString() || new Date().toISOString(),
          };

          const { error: insertError } = await supabase
            .from('inbox_emails')
            .insert(emailData);

          if (insertError) {
            console.error(`[SYNC-INBOX] ❌ Error inserting message:`, insertError.message);
          } else {
            console.log(`[SYNC-INBOX] ✓ Inserted message: ${parsed.subject}`);
            syncedCount++;
          }
        } catch (msgError) {
          console.error(`[SYNC-INBOX] ❌ Error processing message #${message.seq}:`, msgError.message);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    console.log('[SYNC-INBOX] ✓ IMAP connection closed');

    return syncedCount;
  } catch (error) {
    console.error('[SYNC-INBOX] ❌ IMAP error:', error.message);
    console.error('[SYNC-INBOX] Error name:', error.name);
    console.error('[SYNC-INBOX] Error code:', error.code);
    console.error('[SYNC-INBOX] Full error:', JSON.stringify(error, null, 2));

    try {
      if (client.usable) {
        await client.logout();
      }
    } catch (e) {
      console.error('[SYNC-INBOX] Error during logout:', e.message);
    }

    throw new Error(`IMAP connection failed: ${error.message}. Verifica las credenciales y configuración del servidor.`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log('[SYNC-INBOX] ========== REQUEST RECEIVED ==========');
    console.log('[SYNC-INBOX] Timestamp:', new Date().toISOString());

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('[SYNC-INBOX] Supabase URL:', supabaseUrl);
    console.log('[SYNC-INBOX] Service Key present:', !!supabaseServiceKey);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[SYNC-INBOX] Supabase client created successfully');

    const authHeader = req.headers.get('Authorization');
    console.log('[SYNC-INBOX] Authorization header present:', !!authHeader);

    if (!authHeader) {
      console.error('[SYNC-INBOX] ❌ No authorization header');
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId } = await req.json();
    console.log(`[SYNC-INBOX] ✓ Syncing emails for user: ${userId}`);

    console.log('[SYNC-INBOX] Querying email_accounts table...');
    console.log('[SYNC-INBOX] Query params: created_by =', userId, ', is_active = true');

    const { data: accounts, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('created_by', userId)
      .eq('is_active', true);

    if (accountError) {
      console.error('[SYNC-INBOX] ❌ Error fetching accounts:', accountError);
      console.error('[SYNC-INBOX] Error details:', JSON.stringify(accountError, null, 2));
      throw accountError;
    }

    console.log('[SYNC-INBOX] ✓ Database query successful');
    console.log('[SYNC-INBOX] Accounts found:', accounts?.length || 0);

    if (!accounts || accounts.length === 0) {
      console.log('[SYNC-INBOX] No active email accounts found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No hay cuentas de correo configuradas',
          syncedCount: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalSynced = 0;

    for (const account of accounts) {
      console.log(`[SYNC-INBOX] Processing account: ${account.email_address}`);

      try {
        const synced = await fetchEmailsFromIMAP(account, userId, supabase);
        totalSynced += synced;

        const { error: updateError } = await supabase
          .from('email_accounts')
          .update({ last_sync: new Date().toISOString() })
          .eq('id', account.id);

        if (updateError) {
          console.error('[SYNC-INBOX] Error updating last_sync:', updateError);
        } else {
          console.log('[SYNC-INBOX] Updated last_sync timestamp');
        }

        console.log(`[SYNC-INBOX] ✓ Completed sync for account: ${account.email_address}`);
      } catch (accountError) {
        console.error(`[SYNC-INBOX] ❌ Error syncing account ${account.email_address}:`, accountError.message);
      }
    }

    console.log(`[SYNC-INBOX] ========== SYNC COMPLETED ==========`);
    console.log(`[SYNC-INBOX] Total emails synced: ${totalSynced}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Se sincronizaron ${totalSynced} emails nuevos`,
        syncedCount: totalSynced,
        accountsProcessed: accounts.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SYNC-INBOX] ❌ Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al sincronizar emails',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
