/* Destrava — o Worker existe por um motivo só: guardar a chave do Gemini.
   A pagina chama /api/gemini/... no proprio dominio; aqui a chave e
   acrescentada a partir do segredo do Cloudflare, que nunca chega ao
   navegador nem ao repositorio. Todo o resto e arquivo estatico. */

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";

// Só estes dois metodos, e so nomes de modelo plausiveis: a rota vem da
// pagina, entao e tratada como entrada nao confiavel.
const ROTA_OK = /^[A-Za-z0-9._-]{1,64}:(generateContent|streamGenerateContent)$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // A pagina pergunta no boot se o servidor tem chave. Se tiver, ela
    // nunca pede chave ao usuario.
    if (url.pathname === "/api/status") {
      return Response.json(
        { chave: Boolean(env.GEMINI_KEY) },
        { headers: { "cache-control": "no-store" } },
      );
    }

    if (url.pathname.startsWith("/api/gemini/")) {
      if (request.method !== "POST")
        return new Response("Use POST.", { status: 405 });

      if (!env.GEMINI_KEY)
        return Response.json(
          { error: { message: "O servidor não tem GEMINI_KEY configurada." } },
          { status: 503 },
        );

      const alvo = url.pathname.slice("/api/gemini/".length);
      if (!ROTA_OK.test(alvo))
        return new Response("Rota inválida.", { status: 400 });

      const destino = new URL(`${GEMINI}/${alvo}`);
      if (url.searchParams.get("alt") === "sse")
        destino.searchParams.set("alt", "sse");
      destino.searchParams.set("key", env.GEMINI_KEY);

      const upstream = await fetch(destino, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: await request.text(),
      });

      // Repassa o corpo como veio — inclusive o SSE, que precisa fluir
      // aos poucos para a conversa aparecer sendo escrita.
      const headers = new Headers(upstream.headers);
      headers.delete("content-encoding");
      headers.delete("content-length");
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    return env.ASSETS.fetch(request);
  },
};
