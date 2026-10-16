export async function sendTelegram(method, token, payload) {
  if (!token) {
    console.error('❌ BOT_TOKEN is missing or undefined!');
    return null;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);
    if (!data?.ok) {
      console.error(`❌ Telegram API Error [${method}]:`, JSON.stringify(data));
    }
    return data;
  } catch (err) {
    console.error(`❌ Network error calling Telegram [${method}]:`, err);
    return null;
  }
}

export async function checkMembership(userId, token, channels) {
  if (!channels || !Array.isArray(channels) || channels.length === 0) {
    return { ok: true, missing: [] };
  }

  const checks = channels.map(async (ch) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${ch}&user_id=${userId}`);
      const data = await res.json();
      if (!data.ok || !['member', 'administrator', 'creator'].includes(data.result?.status)) {
        return ch;
      }
    } catch {
      return ch;
    }
    return null;
  });

  const missing = (await Promise.all(checks)).filter(Boolean);
  return { ok: missing.length === 0, missing };
}
