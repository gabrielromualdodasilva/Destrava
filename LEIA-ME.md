# Larissa

Professora de inglês por voz, movida a Gemini. Um arquivo só: `index.html`.

A trilha de 42 lições segue a sequência gramatical do **Inglês do Jerry 3.0**.
As frases do treino de pronúncia "ISP" são as do **Mairo Vergara 4.0**.
Nenhum conteúdo das apostilas foi copiado para dentro do app — só a ordem dos
assuntos. As explicações e exercícios são gerados pela Larissa na hora.

## 1. Pegar a chave do Gemini

1. Abra <https://aistudio.google.com/apikey>
2. Entre com sua conta Google, toque em **Create API key**
3. Copie a chave (começa com `AIza`)

O app pede essa chave na primeira tela. Ela fica guardada só no navegador do
aparelho, e vai direto do seu celular para o Google — não passa por servidor
nenhum meu ou de terceiros.

## 2. Testar agora, no computador

Dê dois cliques em `index.html`. Abre no navegador e já funciona.

Use o **Chrome**. O microfone depende da API de reconhecimento de voz, que o
Chrome tem e o Firefox não. No Safari do iPhone ela existe mas falha bastante.

## 3. Colocar no celular

O arquivo precisa estar numa URL para virar app de celular. Escolha um:

**Netlify Drop** (mais rápido, sem conta)
1. Abra <https://app.netlify.com/drop>
2. Arraste a pasta `Larissa` inteira para a página
3. Ele devolve um endereço tipo `https://algo-aleatorio.netlify.app`

**Cloudflare Pages** (grátis, endereço fixo)
1. <https://pages.cloudflare.com> › Create › Upload assets
2. Arraste a pasta, dê um nome

Depois, no celular: abra o endereço no Chrome › menu › **Adicionar à tela
inicial**. Vira um ícone e abre em tela cheia, sem barra de navegador.

> O endereço fica público para quem souber dele. Como sua chave está dentro da
> página, não divulgue o link. Se quiser publicar de verdade, restrinja a chave
> por site (HTTP referrer) no Google Cloud Console, ou coloque um Cloudflare
> Worker na frente para escondê-la.

## 4. Voz feminina

Em **Ajustes › Voz da Larissa** você escolhe entre as vozes em inglês
instaladas no aparelho. O app já tenta pegar uma feminina sozinho, mas quais
existem varia de celular para celular:

- **Android/Chrome**: as melhores são as do Google. Se a lista vier vazia,
  vá em Configurações › Idiomas › Saída de texto para voz › instalar inglês.
- **iPhone**: Samantha é a padrão feminina em inglês.
- **Windows**: Microsoft Zira ou Aria.

O botão **Testar esta voz** faz ela falar uma frase para você comparar.

## 5. Se der erro

| Mensagem | O que fazer |
|---|---|
| Chave da API inválida | Confira em Ajustes; a chave começa com `AIza` |
| O modelo não existe para essa chave | Ajustes › Modelo › escolha outro da lista |
| Bateu o limite de uso | Camada gratuita tem cota por minuto; espere alguns minutos |
| Gemini sobrecarregado | Tente de novo em instantes, ou troque para Flash-Lite |

Em **Ajustes › Testar conexão** dá para conferir chave e modelo de uma vez.

## 6. Progresso

Fica no navegador do aparelho — não sincroniza sozinho entre celular e
computador. Em **Ajustes › Exportar progresso** sai um `.json` que você importa
no outro aparelho.

As aulas geradas também ficam salvas no aparelho. Cada lição é gerada uma vez
só: depois abre na hora, funciona sem internet e não gasta cota do Gemini de
novo. Dentro da lição, **↻ Gerar outra versão** força uma aula nova com outros
exemplos. Em **Ajustes › Aulas salvas** dá para ver quantas existem e limpar.

## O que a nota de pronúncia significa

O app compara o que o reconhecimento de voz do seu aparelho **entendeu** com a
frase alvo. Se ele ouve *tree* onde deveria ouvir *three*, seu TH precisa de
treino — é sinal real. Mas não é uma nota por fonema, e às vezes o erro é do
reconhecimento, não seu. Para avaliação fonema a fonema de verdade seria
preciso o Azure Speech (Pronunciation Assessment), que dá nota por som e tem
camada gratuita — dá para plugar depois se você quiser.
