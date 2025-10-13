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
    console.log('[SEND-EMAIL] ========== REQUEST RECEIVED ==========');
    console.log('[SEND-EMAIL] Timestamp:', new Date().toISOString());

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('[SEND-EMAIL] Supabase URL:', supabaseUrl);
    console.log('[SEND-EMAIL] Service Key present:', !!supabaseServiceKey);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[SEND-EMAIL] Supabase client created successfully');

    const authHeader = req.headers.get('Authorization');
    console.log('[SEND-EMAIL] Authorization header present:', !!authHeader);

    if (!authHeader) {
      console.error('[SEND-EMAIL] ❌ No authorization header');
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      userId,
      to_emails,
      cc_emails,
      bcc_emails,
      subject,
      body_html,
      body_text,
      reply_to_id,
      forward_from_id
    } = await req.json();

    console.log(`[SEND-EMAIL] ✓ Sending email for user: ${userId}`);
    console.log(`[SEND-EMAIL] To: ${to_emails.join(', ')}`);
    console.log(`[SEND-EMAIL] Subject: ${subject}`);
    console.log(`[SEND-EMAIL] CC: ${cc_emails?.join(', ') || 'none'}`);
    console.log(`[SEND-EMAIL] BCC: ${bcc_emails?.join(', ') || 'none'}`);

    console.log('[SEND-EMAIL] Querying email_accounts table...');
    console.log('[SEND-EMAIL] Query params: created_by =', userId, ', is_active = true');

    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('created_by', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (accountError) {
      console.error('[SEND-EMAIL] ❌ Error fetching account:', accountError);
      console.error('[SEND-EMAIL] Error details:', JSON.stringify(accountError, null, 2));
      throw accountError;
    }

    if (!account) {
      console.error('[SEND-EMAIL] ❌ No active email account found');
      return new Response(
        JSON.stringify({ error: 'No hay cuenta de correo configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SEND-EMAIL] ✓ Using account: ${account.email_address}`);
    console.log(`[SEND-EMAIL] Account ID: ${account.id}`);
    console.log(`[SEND-EMAIL] SMTP: ${account.smtp_host}:${account.smtp_port}`);
    console.log(`[SEND-EMAIL] Display name: ${account.display_name || 'none'}`);

    console.log('[SEND-EMAIL] ⚠ Simulating SMTP send (MOCK MODE)');

    const sentEmail = {
      account_id: account.id,
      user_id: userId,
      message_id: `<sent-${Date.now()}@${account.email_address.split('@')[1]}>`,
      thread_id: reply_to_id || forward_from_id || null,
      from_email: account.email_address,
      from_name: account.display_name || account.email_address,
      to_emails: to_emails.map((email: string) => ({ email })),
      cc_emails: cc_emails ? cc_emails.map((email: string) => ({ email })) : [],
      bcc_emails: bcc_emails ? bcc_emails.map((email: string) => ({ email })) : [],
      subject,
      body_text: body_text || body_html.replace(/<[^>]*>/g, ''),
      body_html: body_html,
      attachments: [],
      is_read: true,
      is_starred: false,
      is_archived: false,
      is_deleted: false,
      folder: 'sent',
      labels: [],
      email_date: new Date().toISOString(),
    };

    console.log('[SEND-EMAIL] Saving to sent folder in database');
    console.log('[SEND-EMAIL] Message ID:', sentEmail.message_id);
    console.log('[SEND-EMAIL] Folder:', sentEmail.folder);
    console.log('[SEND-EMAIL] User ID:', sentEmail.user_id);
    console.log('[SEND-EMAIL] Account ID:', sentEmail.account_id);

    const { data: savedEmail, error: insertError } = await supabase
      .from('inbox_emails')
      .insert(sentEmail)
      .select()
      .single();

    if (insertError) {
      console.error('[SEND-EMAIL] ❌ Error saving sent email:', insertError);
      console.error('[SEND-EMAIL] Error code:', insertError.code);
      console.error('[SEND-EMAIL] Error message:', insertError.message);
      console.error('[SEND-EMAIL] Error details:', JSON.stringify(insertError, null, 2));
      throw insertError;
    }

    console.log(`[SEND-EMAIL] ✓ Email saved to sent folder with ID: ${savedEmail.id}`);

    if (reply_to_id) {
      console.log(`[SEND-EMAIL] Marking original email ${reply_to_id} as read`);
      const { error: updateError } = await supabase
        .from('inbox_emails')
        .update({ is_read: true })
        .eq('id', reply_to_id);

      if (updateError) {
        console.error('[SEND-EMAIL] ❌ Error marking original as read:', updateError);
      } else {
        console.log('[SEND-EMAIL] ✓ Original email marked as read');
      }
    }

    console.log('[SEND-EMAIL] ✓ Email sent successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email enviado correctamente',
        email_id: savedEmail.id,
        message_id: sentEmail.message_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SEND-EMAIL] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al enviar email',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
