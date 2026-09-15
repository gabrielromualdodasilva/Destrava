/* Destrava — a portinha da API.

   A pagina mora no Firebase (destravaingles.web.app). Este Worker existe
   so para guardar a chave do Gemini: ele recebe a chamada da pagina,
   acrescenta a chave a partir do segredo do Cloudflare e repassa ao
   Google. A chave nunca chega ao navegador nem ao repositorio.

   O endereco deste Worker e encanamento — ninguem o ve. */

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";

// Quem pode chamar. Qualquer outro site recebe a resposta sem o cabecalho
// de liberacao, e o navegador dele bloqueia a leitura.
const ORIGENS = new Set([
  "https://destravaingles.web.app",
  "https://destravaingles.firebaseapp.com",
]);

// So estes dois metodos, e so nomes de modelo plausiveis: o caminho vem do
// cliente, entao e tratado como entrada nao confiavel.
const ROTA_OK = /^[A-Za-z0-9._-]{1,64}:(generateContent|streamGenerateContent)$/;

function liberar(origin) {
  const h = new Headers();
  if (origin && ORIGENS.has(origin)) {
    h.set("access-control-allow-origin", origin);
    h.set("vary", "Origin");
  }
  return h;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const livre = liberar(origin);

    // O navegador pergunta antes de mandar JSON para outro dominio.
    if (request.method === "OPTIONS") {
      livre.set("access-control-allow-methods", "POST, GET, OPTIONS");
      livre.set("access-control-allow-headers", "content-type");
      livre.set("access-control-max-age", "86400");
      return new Response(null, { status: 204, headers: livre });
    }

    if (url.pathname === "/api/status") {
      livre.set("content-type", "application/json");
      livre.set("cache-control", "no-store");
      return new Response(JSON.stringify({ chave: Boolean(env.GEMINI_KEY) }), { headers: livre });
    }

    if (url.pathname.startsWith("/api/gemini/")) {
      if (request.method !== "POST")
        return new Response("Use POST.", { status: 405, headers: livre });

      if (!env.GEMINI_KEY) {
        livre.set("content-type", "application/json");
        return new Response(
          JSON.stringify({ error: { message: "O servidor não tem GEMINI_KEY configurada." } }),
          { status: 503, headers: livre },
        );
      }

      const alvo = url.pathname.slice("/api/gemini/".length);
      if (!ROTA_OK.test(alvo))
        return new Response("Rota inválida.", { status: 400, headers: livre });

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
