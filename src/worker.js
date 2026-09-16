/* Destrava — a portinha de tras.

   Duas responsabilidades, ambas por um motivo so: guardar credencial fora
   do navegador.

   1. GEMINI_KEY — a chave do Gemini. A pagina chama /api/gemini/... aqui,
      e a chave e acrescentada deste lado.
   2. SA_JSON — a conta de servico do Firebase. Permite criar e apagar
      alunos, que o navegador nao pode fazer desde que o auto-cadastro foi
      desativado. Quem chama precisa provar que e administrador. */

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
const IDT = "https://identitytoolkit.googleapis.com/v1";
const PROJETO = "destravaapp";

/* Azure Speech: 500 mil caracteres por mes de graca, contra 10 audios por dia
   do Gemini. Devolve MP3 pronto, entao nao precisa montar cabecalho WAV. */
const AZ_FORMATO = "audio-24khz-48kbitrate-mono-mp3";
const VOZ_OK = /^[a-z]{2}-[A-Z]{2}-[A-Za-z]{2,30}Neural$/;
const LOCALE_OK = /^[a-z]{2}-[A-Z]{2}$/;

const escaparXml = t => String(t)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

async function vozAzure(request, env, livre){
  if(!env.AZURE_KEY || !env.AZURE_REGION)
    return json({ erro: "Azure não configurado no servidor." }, 503, livre);

  const b = await request.json().catch(() => ({}));
  const texto = String(b.texto || "").slice(0, 1500);
  const voz = String(b.voz || "pt-BR-ThalitaMultilingualNeural");
  if (!texto.trim()) return json({ erro: "Sem texto." }, 400, livre);
  if (!VOZ_OK.test(voz)) return json({ erro: "Nome de voz inválido." }, 400, livre);

  /* Nas vozes multilingues o timbre e o mesmo, mas o sotaque segue o idioma
     declarado. Por isso a pagina diz em que lingua o texto esta. */
  const idioma = LOCALE_OK.test(String(b.idioma || "")) ? b.idioma : voz.slice(0, 5);

  /* Velocidade vira prosody. Sem isso o botao "devagar" do treino de
     pronuncia soava igual ao normal — o Azure nao tem como adivinhar. */
  const taxa = Math.min(1.5, Math.max(0.5, Number(b.taxa) || 1));
  const pct = Math.round((taxa - 1) * 100);
  const corpoFala = pct === 0
    ? escaparXml(texto)
    : `<prosody rate="${pct > 0 ? "+" : ""}${pct}%">${escaparXml(texto)}</prosody>`;

  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${idioma}">` +
    `<voice name="${voz}">${corpoFala}</voice></speak>`;

  const r = await fetch(`https://${env.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.AZURE_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": AZ_FORMATO,
      "User-Agent": "destrava",
    },
    body: ssml,
  });
  if (!r.ok)
    return json({ erro: `Azure recusou (${r.status}).` }, 502, livre);

  const h = new Headers(livre);
  h.set("content-type", "audio/mpeg");
  h.set("cache-control", "max-age=604800");
  return new Response(r.body, { status: 200, headers: h });
}

async function vozesAzure(env, livre){
  if(!env.AZURE_KEY || !env.AZURE_REGION) return json([], 503, livre);
  const r = await fetch(
    `https://${env.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
    { headers: { "Ocp-Apim-Subscription-Key": env.AZURE_KEY } },
  );
  if(!r.ok) return json([], 502, livre);
  const todas = await r.json().catch(() => []);
  // so as neurais de portugues do Brasil e ingles americano, mulheres primeiro
  const lista = (todas || [])
    .filter(v => /^(pt-BR|en-US)$/.test(v.Locale) && /Neural/.test(v.ShortName))
    .map(v => ({
      nome: v.ShortName,
      rotulo: v.LocalName || v.DisplayName || v.ShortName,
      locale: v.Locale,
      feminina: v.Gender === "Female",
      multilingue: /Multilingual/i.test(v.ShortName),
    }))
    // portugues primeiro: as dicas sao em portugues, e a multilingue brasileira
    // e a que soa natural nos dois idiomas
    .sort((a, b) =>
      ((b.locale === "pt-BR") - (a.locale === "pt-BR")) ||
      (b.multilingue - a.multilingue) ||
      (b.feminina - a.feminina) ||
      a.rotulo.localeCompare(b.rotulo));
  livre.set("cache-control", "max-age=3600");
  return json(lista, 200, livre);
}

// Chave web do Firebase: publica por natureza, ja vai no HTML da pagina.
// Identifica o projeto, nao autoriza nada sozinha.
const CHAVE_WEB = "AIzaSyCPbpiqSsHqzrdGnw5RG0_i_Q85ThWQGeM";

// Quem pode criar e apagar alunos. Conferido no servidor, nunca no cliente.
const ADMINS = new Set([
  "gabriel.silva@tmtlog.com",
  "gabriel.silva.tmt@gmail.com",
  "admin@destrava.app",
]);

const ORIGENS = new Set([
  "https://destravalinguas.web.app",
  "https://destravalinguas.firebaseapp.com",
  "https://destravaapp.web.app",
]);

const ROTA_IA = /^[A-Za-z0-9._-]{1,64}:(generateContent|streamGenerateContent)$/;

function liberar(origin) {
  const h = new Headers();
  if (origin && ORIGENS.has(origin)) {
    h.set("access-control-allow-origin", origin);
    h.set("vary", "Origin");
  }
  return h;
}

const json = (dados, status, headers) => {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  return new Response(JSON.stringify(dados), { status: status || 200, headers: h });
};

/* ---------------------------------------------------------------- conta de servico */

const b64url = buf =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let tokenCache = { valor: null, expira: 0 };

async function tokenAdmin(env) {
  const agora = Math.floor(Date.now() / 1000);
  if (tokenCache.valor && tokenCache.expira > agora + 60) return tokenCache.valor;

  const sa = JSON.parse(env.SA_JSON);
  const enc = new TextEncoder();
  const cabecalho = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const corpo = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: sa.token_uri,
    iat: agora,
    exp: agora + 3600,
  })));

  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", chave, enc.encode(cabecalho + "." + corpo),
  );
  const jwt = `${cabecalho}.${corpo}.${b64url(assinatura)}`;

  const r = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error("sem token de administrador");
  tokenCache = { valor: d.access_token, expira: agora + (d.expires_in || 3600) };
  return d.access_token;
}

/* Quem esta chamando? O navegador manda o proprio token do Firebase; o
   Google confere se ele e valido e diz de quem e. */
async function quemChama(request) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const r = await fetch(`${IDT}/accounts:lookup?key=${CHAVE_WEB}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: auth.slice(7) }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.users && d.users[0]) || null;
  } catch (e) { return null; }
}

async function chamaAdmin(env, caminho, metodo, corpo) {
  const t = await tokenAdmin(env);
  const r = await fetch(`${IDT}/projects/${PROJETO}${caminho}`, {
    method: metodo,
    headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}

/* ---------------------------------------------------------------- alunos */

async function alunos(request, env, livre) {
  if (!env.SA_JSON)
    return json({ erro: "O servidor não tem credencial de administrador." }, 503, livre);

  const quem = await quemChama(request);
  if (!quem) return json({ erro: "Faça login de novo." }, 401, livre);
  if (!ADMINS.has((quem.email || "").toLowerCase()))
    return json({ erro: "Só o administrador pode gerenciar alunos." }, 403, livre);

  if (request.method === "GET") {
    const { ok, d } = await chamaAdmin(env, "/accounts:batchGet?maxResults=200", "GET");
    if (!ok) return json({ erro: "Não consegui listar." }, 502, livre);
    const lista = (d.users || []).map(u => ({
      uid: u.localId,
      email: u.email || "",
      criadoEm: Number(u.createdAt) || 0,
      ultimoAcesso: Number(u.lastLoginAt) || 0,
      desativado: !!u.disabled,
      admin: ADMINS.has((u.email || "").toLowerCase()),
    })).sort((a, b) => b.criadoEm - a.criadoEm);
    return json({ alunos: lista }, 200, livre);
  }

  if (request.method === "POST") {
    const b = await request.json().catch(() => ({}));
    const email = String(b.email || "").trim().toLowerCase();
    const senha = String(b.senha || "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return json({ erro: "E-mail inválido." }, 400, livre);
    if (senha.length < 6)
      return json({ erro: "A senha precisa de pelo menos 6 caracteres." }, 400, livre);

    const { ok, d } = await chamaAdmin(env, "/accounts", "POST",
      { email, password: senha, emailVerified: false });
    if (!ok) {
      const m = (d.error && d.error.message) || "";
      if (/EMAIL_EXISTS/.test(m)) return json({ erro: "Esse e-mail já tem conta." }, 409, livre);
      return json({ erro: "Não consegui criar: " + m.slice(0, 80) }, 502, livre);
    }
    return json({ uid: d.localId, email }, 201, livre);
  }

  if (request.method === "DELETE") {
    const b = await request.json().catch(() => ({}));
    const uid = String(b.uid || "");
    if (!uid) return json({ erro: "Falta o identificador." }, 400, livre);
    if (uid === quem.localId)
      return json({ erro: "Você não pode apagar a própria conta." }, 400, livre);
    const { ok } = await chamaAdmin(env, "/accounts:delete", "POST", { localId: uid });
    if (!ok) return json({ erro: "Não consegui apagar." }, 502, livre);
    return json({ ok: true }, 200, livre);
  }

  return new Response("Método não suportado.", { status: 405, headers: livre });
}

/* ---------------------------------------------------------------- entrada */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const livre = liberar(request.headers.get("Origin"));

    if (request.method === "OPTIONS") {
      livre.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
      livre.set("access-control-allow-headers", "content-type, authorization");
      livre.set("access-control-max-age", "86400");
      return new Response(null, { status: 204, headers: livre });
    }

    if (url.pathname === "/api/status") {
      livre.set("cache-control", "no-store");
      return json({
        chave: Boolean(env.GEMINI_KEY),
        admin: Boolean(env.SA_JSON),
        azure: Boolean(env.AZURE_KEY && env.AZURE_REGION),
      }, 200, livre);
    }

    if (url.pathname === "/api/alunos") return alunos(request, env, livre);
    if (url.pathname === "/api/voz" && request.method === "POST") return vozAzure(request, env, livre);
    if (url.pathname === "/api/vozes") return vozesAzure(env, livre);

    // Quais modelos esta chave pode usar. O Google aposenta modelo sem aviso,
    // entao a lista vem dele, nao de uma constante no codigo.
    if (url.pathname === "/api/models") {
      if (!env.GEMINI_KEY) return json([], 503, livre);
      const r = await fetch(`${GEMINI}?key=${env.GEMINI_KEY}&pageSize=200`);
      const d = await r.json().catch(() => ({}));
      const lista = (d.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map(m => ({ id: String(m.name || "").replace("models/", ""), nome: m.displayName || "" }));
      livre.set("cache-control", "max-age=3600");
      return json(lista, r.status, livre);
    }

    if (url.pathname.startsWith("/api/gemini/")) {
      if (request.method !== "POST")
        return new Response("Use POST.", { status: 405, headers: livre });
      if (!env.GEMINI_KEY)
        return json({ error: { message: "O servidor não tem GEMINI_KEY configurada." } }, 503, livre);

      const alvo = url.pathname.slice("/api/gemini/".length);
      if (!ROTA_IA.test(alvo)) return new Response("Rota inválida.", { status: 400, headers: livre });

      const destino = new URL(`${GEMINI}/${alvo}`);
      if (url.searchParams.get("alt") === "sse") destino.searchParams.set("alt", "sse");
      destino.searchParams.set("key", env.GEMINI_KEY);

      const upstream = await fetch(destino, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: await request.text(),
      });

      // Repassa o corpo como veio — inclusive o SSE, que precisa fluir aos
      // poucos para a resposta da Larissa aparecer sendo escrita.
      const headers = new Headers(upstream.headers);
      headers.delete("content-encoding");
      headers.delete("content-length");
      for (const [k, v] of livre) headers.set(k, v);
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    return env.ASSETS.fetch(request);
  },
};
