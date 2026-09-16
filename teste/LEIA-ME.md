# Testes

Rodam a página num DOM de verdade (jsdom), com Firebase, voz e Worker
simulados. Existem porque `node --check` valida sintaxe, não execução — uma
variável `let` usada antes da declaração já derrubou a página inteira com a
sintaxe perfeita.

```
npm install jsdom
node teste/completo.mjs public/index.html    # 24 verificações
node teste/fumaca.mjs   public/index.html    # checagem rápida
```

O `completo.mjs` percorre o app como uma pessoa: escolhe o idioma, abre a
primeira lição, responde os cinco exercícios, confere a nota, passa por
todas as abas e volta para a trilha para ver se a lição ficou marcada.

Rode antes de publicar.
