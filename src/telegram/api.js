export async function sendTelegram(method, token, payload) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function checkMembership(userId, token, channels) {
  if (!channels || channels.length === 0) return { ok: true };

  const checks = channels.map(async (ch) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${ch}&user_id=${userId}`);
      const data = await res.json();
      if (!data.ok || !['member', 'administrator', 'creator'].includes(data.result.status)) {
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
