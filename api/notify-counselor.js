// ============================================================
// SALON三日月 - 公認心理師通知メール送信API
// Resend経由でメール送信(Vercel Functions上で動作)
// ============================================================

export default async function handler(req, res) {
  // CORSヘッダー(同一オリジン前提だが、念のため)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 環境変数チェック
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({
      error: 'RESEND_API_KEY is not set. Configure it in Vercel Settings > Environment Variables.'
    });
  }

  // 入力の取得
  const {
    counselorEmail,
    counselorName,
    customerName,
    sessionDate,
    sessionNumber,
    zoomUrl,
  } = req.body || {};

  // 必須項目チェック
  if (!counselorEmail) {
    return res.status(400).json({ error: '公認心理師のメールアドレスが必要です。' });
  }
  if (!customerName) {
    return res.status(400).json({ error: '顧客名が必要です。' });
  }

  // 日時のフォーマット
  const formatJpDate = (iso) => {
    if (!iso) return '(日時未定)';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '(日時未定)';
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日(${'日月火水木金土'[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const dt = formatJpDate(sessionDate);

  // メール本文(HTML版)
  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family: 'Hiragino Sans', sans-serif; color: #44403c; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 3px solid #d4a04b; padding-top: 16px;">
    <h2 style="color: #57534e; font-family: 'Hiragino Mincho', serif; letter-spacing: 0.05em;">
      ${counselorName || '公認心理師'} 様
    </h2>
    <p>SALON三日月よりオンラインカウンセリング(慧月)の予約をお知らせいたします。</p>

    <div style="background: #faf8f5; border: 1px solid #e7e0d5; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #78716c; width: 110px;">クライアント</td>
          <td style="padding: 6px 0; font-weight: 500;">${customerName} 様</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #78716c;">予約日時</td>
          <td style="padding: 6px 0; font-weight: 500;">${dt}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #78716c;">セッション回</td>
          <td style="padding: 6px 0;">${sessionNumber || 1}回目(全2回)</td>
        </tr>
        ${zoomUrl ? `
        <tr>
          <td style="padding: 6px 0; color: #78716c;">Zoom URL</td>
          <td style="padding: 6px 0;"><a href="${zoomUrl}" style="color: #b8862e;">${zoomUrl}</a></td>
        </tr>` : ''}
      </table>
    </div>

    <div style="background: #fef9e7; border-left: 3px solid #d4a04b; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #78350f;">
      <strong>※ 公認心理師法に基づき、クライアントから発信された事実のみをご記録ください。</strong><br>
      診断・評価・症状名・所感等は記録対象外となります。
    </div>

    <p>当日はよろしくお願いいたします。</p>

    <hr style="border: none; border-top: 1px solid #e7e0d5; margin: 24px 0 16px;">
    <p style="font-size: 12px; color: #a8a29e; text-align: center;">
      SALON三日月 顧客管理システム<br>
      予防・養生支援を目的としたサービスです(医療行為ではありません)
    </p>
  </div>
</body>
</html>
  `.trim();

  // テキスト版(HTMLが見られないメーラー用)
  const textBody = `
${counselorName || '公認心理師'} 様

SALON三日月よりオンラインカウンセリング(慧月)の予約をお知らせいたします。

─────────────────────
■ クライアント:${customerName} 様
■ 予約日時:${dt}
■ セッション回:${sessionNumber || 1}回目(全2回)
${zoomUrl ? `■ Zoom URL:${zoomUrl}` : ''}
─────────────────────

※ 公認心理師法に基づき、クライアントから発信された事実のみをご記録ください。
※ 診断・評価・症状名・所感等は記録対象外となります。

当日はよろしくお願いいたします。

SALON三日月
予防・養生支援を目的としたサービスです(医療行為ではありません)
  `.trim();

  // Resend API経由で送信
  // ※ テストモードでは onboarding@resend.dev から送信(送信先はResend登録時のメールアドレス本人のみ)
  // ※ 本番運用時は notification@maria-beauty.com 等に変更(DNS設定後)
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'SALON三日月 <onboarding@resend.dev>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [counselorEmail],
        subject: `【SALON三日月】慧月予約のお知らせ - ${customerName} 様`,
        html: htmlBody,
        text: textBody,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return res.status(response.status).json({
        error: data.message || 'メール送信に失敗しました。',
        detail: data,
      });
    }

    return res.status(200).json({
      success: true,
      messageId: data.id,
      sentTo: counselorEmail,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Send mail error:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
