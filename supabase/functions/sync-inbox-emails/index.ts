import { createClient } from 'npm:@supabase/supabase-js@2';
import Imap from 'npm:imap@0.8.19';
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
  return new Promise((resolve, reject) => {
    console.log(`[SYNC-INBOX] 📧 Connecting to IMAP: ${account.imap_host}:${account.imap_port}`);

    const imap = new Imap({
      user: account.imap_username,
      password: account.imap_password,
      host: account.imap_host,
      port: account.imap_port,
      tls: account.use_ssl,
      tlsOptions: { rejectUnauthorized: false },
    });

    let syncedCount = 0;

    imap.once('ready', () => {
      console.log('[SYNC-INBOX] ✓ IMAP connection established');

      imap.openBox('INBOX', false, async (err, box) => {
        if (err) {
          console.error('[SYNC-INBOX] ❌ Error opening INBOX:', err);
          imap.end();
          reject(err);
          return;
        }

        console.log(`[SYNC-INBOX] ✓ INBOX opened. Total messages: ${box.messages.total}`);

        if (box.messages.total === 0) {
          console.log('[SYNC-INBOX] No messages in INBOX');
          imap.end();
          resolve(0);
          return;
        }

        const fetchCount = Math.min(50, box.messages.total);
        const startSeq = Math.max(1, box.messages.total - fetchCount + 1);
        console.log(`[SYNC-INBOX] Fetching last ${fetchCount} messages (${startSeq}:${box.messages.total})`);

        const fetch = imap.seq.fetch(`${startSeq}:*`, {
          bodies: '',
          struct: true,
        });

        fetch.on('message', (msg, seqno) => {
          console.log(`[SYNC-INBOX] Processing message #${seqno}`);

          msg.on('body', (stream) => {
            simpleParser(stream, async (err, parsed) => {
              if (err) {
                console.error(`[SYNC-INBOX] ❌ Error parsing message #${seqno}:`, err);
                return;
              }

              try {
                const messageId = parsed.messageId || `<generated-${Date.now()}-${seqno}@${account.email_address.split('@')[1]}>`;

                console.log(`[SYNC-INBOX] Message #${seqno}: ${parsed.subject || '(no subject)'}`);
                console.log(`[SYNC-INBOX] Message ID: ${messageId}`);

                const { data: existing } = await supabase
                  .from('inbox_emails')
                  .select('id')
                  .eq('message_id', messageId)
                  .maybeSingle();

                if (existing) {
                  console.log(`[SYNC-INBOX] ⊘ Message already exists, skipping`);
                  return;
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
                  console.error(`[SYNC-INBOX] ❌ Error inserting message #${seqno}:`, insertError);
                } else {
                  console.log(`[SYNC-INBOX] ✓ Inserted message: ${parsed.subject}`);
                  syncedCount++;
                }
              } catch (error) {
                console.error(`[SYNC-INBOX] ❌ Error processing message #${seqno}:`, error);
              }
            });
          });
        });

        fetch.once('error', (err) => {
          console.error('[SYNC-INBOX] ❌ Fetch error:', err);
          imap.end();
          reject(err);
        });

        fetch.once('end', () => {
          console.log('[SYNC-INBOX] ✓ Fetch completed');
          setTimeout(() => {
            imap.end();
          }, 2000);
        });
      });
    });

    imap.once('error', (err) => {
      console.error('[SYNC-INBOX] ❌ IMAP connection error:', err);
      reject(err);
    });

    imap.once('end', () => {
      console.log('[SYNC-INBOX] ✓ IMAP connection closed');
      resolve(syncedCount);
    });

    imap.connect();
  });
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
        console.error(`[SYNC-INBOX] ❌ Error syncing account ${account.email_address}:`, accountError);
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
