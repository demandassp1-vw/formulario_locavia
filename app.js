// ============================================================
//  app.js — Lógica principal do encurtador
// ============================================================

function generateSlug(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let slug = '';
  for (let i = 0; i < len; i++) slug += chars[Math.floor(Math.random() * chars.length)];
  return slug;
}

function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

async function slugExists(slug) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/links?slug=eq.${slug}&select=slug`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const data = await res.json();
  return data && data.length > 0;
}

async function uniqueSlug() {
  for (let i = 0; i < 5; i++) {
    const slug = generateSlug(6);
    if (!(await slugExists(slug))) return slug;
  }
  return generateSlug(8);
}

async function insertLink(slug, originalUrl) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/links`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ slug, original_url: originalUrl, clicks: 0 })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Erro ao salvar no banco');
  }
  return await res.json();
}

// Monta URL de redirecionamento
function buildShortUrl(slug) {
  return `${BASE_URL}/r.html?s=${slug}`;
}

// === QR CODE ===
function generateQR(url) {
  const wrapper = document.getElementById('qrCanvas');
  // Limpa QR anterior
  wrapper.innerHTML = '';
  new QRCode(wrapper, {
    text: url,
    width: 200,
    height: 200,
    colorDark: '#0d7c66',
    colorLight: '#f0faf7',
    correctLevel: QRCode.CorrectLevel.M
  });
}

function downloadQR() {
  // qrcodejs gera uma img dentro do wrapper
  const img = document.querySelector('#qrCanvas img');
  const canvas = document.querySelector('#qrCanvas canvas');
  const a = document.createElement('a');
  if (canvas) {
    a.href = canvas.toDataURL('image/png');
  } else if (img) {
    a.href = img.src;
  } else {
    alert('QR Code ainda não gerado.');
    return;
  }
  a.download = 'qrcode-assinatura.png';
  a.click();
}

// === ENCURTAR ===
async function shortenUrl() {
  const input   = document.getElementById('longUrl');
  const btn     = document.getElementById('shortenBtn');
  const btnText = document.getElementById('btnText');
  const spinner = document.getElementById('btnSpinner');
  const errorBox= document.getElementById('errorBox');

  const url = input.value.trim();

  errorBox.classList.add('hidden');

  if (!url) { showError('Cole uma URL antes de gerar o link.'); return; }
  if (!isValidUrl(url)) { showError('URL inválida. Inclua https:// no início.'); return; }

  btn.disabled = true;
  btnText.textContent = 'Gerando...';
  spinner.classList.remove('hidden');

  try {
    const slug     = await uniqueSlug();
    await insertLink(slug, url);

    const shortUrl = buildShortUrl(slug);

    // Preenche card de resultado
    document.getElementById('shortLinkText').textContent = shortUrl;

    // Esconde form, mostra resultado
    document.getElementById('mainCard').classList.add('hidden');
    document.getElementById('resultCard').classList.remove('hidden');

    // Salva para uso na cópia
    document.getElementById('shortLinkText').dataset.url = shortUrl;

    // Gera QR Code
    generateQR(shortUrl);

    input.value = '';

  } catch (err) {
    showError(`Erro: ${err.message}. Verifique o arquivo config.js e as permissões do Supabase.`);
  } finally {
    btn.disabled = false;
    btnText.textContent = 'GERAR LINK';
    spinner.classList.add('hidden');
  }
}

// === COPIAR ===
async function copyLink() {
  const url = document.getElementById('shortLinkText').dataset.url
           || document.getElementById('shortLinkText').textContent;
  const btn = document.getElementById('copyBtn');
  try {
    await navigator.clipboard.writeText(url);
    btn.classList.add('copied');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    }, 2500);
  } catch { alert('Não foi possível copiar. Selecione o link manualmente.'); }
}

// === LIMPAR ===
function clearInput() {
  document.getElementById('longUrl').value = '';
  document.getElementById('errorBox').classList.add('hidden');
  document.getElementById('longUrl').focus();
}

// === VOLTAR ===
function resetForm() {
  document.getElementById('resultCard').classList.add('hidden');
  document.getElementById('mainCard').classList.remove('hidden');
  document.getElementById('errorBox').classList.add('hidden');
  document.getElementById('longUrl').focus();
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.classList.remove('hidden');
}

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('longUrl').addEventListener('keypress', e => {
    if (e.key === 'Enter') shortenUrl();
  });
});
