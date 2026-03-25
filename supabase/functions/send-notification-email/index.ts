const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Amot <notifications@getamot.app>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EventType =
  | 'bill_created'
  | 'bill_updated'
  | 'bill_deleted'
  | 'bill_settled'
  | 'payment_made'
  | 'payment_confirmed'
  | 'friend_added'
  | 'group_created'
  | 'member_added'
  | 'poke';

interface EmailPayload {
  to: string;
  eventType: EventType;
  recipientName: string;
  payload: Record<string, any>;
}

function buildEmail(eventType: EventType, recipientName: string, payload: Record<string, any>): {
  subject: string;
  html: string;
} {
  const first = recipientName.split(' ')[0];
  const actor = payload.userName || 'Someone';
  const billTitle = payload.billTitle || 'a bill';
  const amount = payload.amount ? `₱${Number(payload.amount).toFixed(2)}` : '';
  const groupName = payload.groupName || 'a group';

  const templates: Record<EventType, { subject: string; body: string }> = {
    bill_created: {
      subject: `${actor} added you to a bill: ${billTitle}`,
      body: `${actor} added you to <strong>${billTitle}</strong>${amount ? ` for <strong>${amount}</strong>` : ''}.`,
    },
    bill_updated: {
      subject: `${actor} updated bill: ${billTitle}`,
      body: `${actor} made changes to <strong>${billTitle}</strong>.`,
    },
    bill_deleted: {
      subject: `${actor} deleted bill: ${billTitle}`,
      body: `${actor} deleted the bill <strong>${billTitle}</strong>.`,
    },
    bill_settled: {
      subject: `Bill settled: ${billTitle}`,
      body: `Great news! The bill <strong>${billTitle}</strong> has been fully settled.`,
    },
    payment_made: {
      subject: `${actor} marked payment as paid — please confirm`,
      body: `${actor} marked ${amount ? `<strong>${amount}</strong>` : 'a payment'} as paid for <strong>${billTitle}</strong>. Please confirm you received it.`,
    },
    payment_confirmed: {
      subject: `${actor} confirmed your payment for ${billTitle}`,
      body: `${actor} confirmed they received your payment${amount ? ` of <strong>${amount}</strong>` : ''} for <strong>${billTitle}</strong>.`,
    },
    friend_added: {
      subject: `${actor} added you as a friend on Amot`,
      body: `${actor} added you as a friend on Amot. You can now split bills together!`,
    },
    group_created: {
      subject: `${actor} added you to group: ${groupName}`,
      body: `${actor} added you to the group <strong>${groupName}</strong> on Amot.`,
    },
    member_added: {
      subject: `${actor} joined group: ${groupName}`,
      body: `${actor} has joined the group <strong>${groupName}</strong>.`,
    },
    poke: {
      subject: `${actor} is reminding you about ${amount ? `${amount} for ` : ''}${billTitle}`,
      body: `${actor} sent you a friendly reminder about ${amount ? `<strong>${amount}</strong> for ` : ''}<strong>${billTitle}</strong>.`,
    },
  };

  const { subject, body } = templates[eventType] ?? {
    subject: 'New activity on Amot',
    body: 'You have new activity on Amot.',
  };

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;max-width:540px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#6366F1;padding:28px 32px;text-align:center;">
              <span style="color:#FFFFFF;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Amot</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${first},</p>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">${body}</p>
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
              <p style="margin:0;font-size:13px;color:#9CA3AF;text-align:center;">
                You're receiving this because you have email notifications enabled on Amot.<br>
                Open the app to manage your notification preferences.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, eventType, recipientName, payload }: EmailPayload = await req.json();

    if (!to || !eventType || !recipientName) {
      return new Response(
        JSON.stringify({ error: 'to, eventType, and recipientName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { subject, html } = buildEmail(eventType, recipientName, payload || {});

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error(`Resend error: ${err}`);
    }

    const result = await resendRes.json();
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-notification-email error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
