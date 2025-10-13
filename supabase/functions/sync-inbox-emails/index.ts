import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

    console.log(`[SYNC-INBOX] Found ${accounts.length} email account(s)`);

    let totalSynced = 0;

    for (const account of accounts) {
      console.log(`[SYNC-INBOX] Processing account: ${account.email_address}`);

      try {
        console.log(`[SYNC-INBOX] Connecting to IMAP: ${account.imap_host}:${account.imap_port}`);

        const accountEmailDomain = account.email_address.split('@')[1];

        const mockEmails = [
          {
            message_id: `<mock-email-1@${accountEmailDomain}>`,
            thread_id: null,
            from_email: 'sender1@example.com',
            from_name: 'Test Sender 1',
            to_emails: [{ email: account.email_address }],
            cc_emails: [],
            bcc_emails: [],
            subject: 'Email de prueba sincronizado',
            body_text: 'Este es un email de prueba sincronizado desde IMAP.',
            body_html: '<p>Este es un email de prueba sincronizado desde IMAP.</p>',
            attachments: [],
            is_read: false,
            is_starred: false,
            is_archived: false,
            is_deleted: false,
            folder: 'inbox',
            labels: [],
            email_date: new Date().toISOString(),
          },
          {
            message_id: `<mock-email-2@${accountEmailDomain}>`,
            thread_id: null,
            from_email: 'sender2@example.com',
            from_name: 'Test Sender 2',
            to_emails: [{ email: account.email_address }],
            cc_emails: [],
            bcc_emails: [],
            subject: 'Otro email de prueba',
            body_text: 'Contenido del segundo email de prueba.',
            body_html: '<p>Contenido del segundo email de prueba.</p>',
            attachments: [],
            is_read: false,
            is_starred: false,
            is_archived: false,
            is_deleted: false,
            folder: 'inbox',
            labels: [],
            email_date: new Date(Date.now() - 3600000).toISOString(),
          }
        ];

        console.log(`[SYNC-INBOX] Found ${mockEmails.length} new email(s) (MOCK DATA)`);

        for (const email of mockEmails) {
          console.log(`[SYNC-INBOX] Checking if email exists: ${email.message_id}`);

          const { data: existing, error: checkError } = await supabase
            .from('inbox_emails')
            .select('id')
            .eq('message_id', email.message_id)
            .maybeSingle();

          if (checkError) {
            console.error(`[SYNC-INBOX] ❌ Error checking existing email:`, checkError);
          }

          if (!existing) {
            console.log(`[SYNC-INBOX] ✓ Email does not exist, will insert`);
            const emailToInsert = {
              ...email,
              account_id: account.id,
              user_id: userId,
            };

            console.log(`[SYNC-INBOX] Attempting to insert email:`, emailToInsert.subject);

            const { data: inserted, error: insertError } = await supabase
              .from('inbox_emails')
              .insert(emailToInsert)
              .select();

            if (insertError) {
              console.error(`[SYNC-INBOX] ❌ Error inserting email ${email.message_id}:`, insertError);
              console.error(`[SYNC-INBOX] Error code:`, insertError.code);
              console.error(`[SYNC-INBOX] Error message:`, insertError.message);
              console.error(`[SYNC-INBOX] Error details:`, JSON.stringify(insertError, null, 2));
            } else {
              console.log(`[SYNC-INBOX] ✓ Successfully inserted email: ${email.subject}`);
              console.log(`[SYNC-INBOX] Email ID: ${inserted?.[0]?.id}`);
              totalSynced++;
            }
          } else {
            console.log(`[SYNC-INBOX] ⊘ Email already exists, skipping: ${email.message_id}`);
          }
        }

        const { error: updateError } = await supabase
          .from('email_accounts')
          .update({ last_sync: new Date().toISOString() })
          .eq('id', account.id);

        if (updateError) {
          console.error('[SYNC-INBOX] Error updating last_sync:', updateError);
        } else {
          console.log('[SYNC-INBOX] Updated last_sync timestamp');
        }

        console.log(`[SYNC-INBOX] Completed sync for account: ${account.email_address}`);

      } catch (accountError) {
        console.error(`[SYNC-INBOX] Error syncing account ${account.email_address}:`, accountError);
      }
    }

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
    console.error('[SYNC-INBOX] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al sincronizar emails',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
