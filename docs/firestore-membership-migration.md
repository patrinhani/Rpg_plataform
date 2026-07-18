# Migração segura de membros das mesas

Esta migração substitui a busca global de mesas pelo campo indexável
`membroUids`. Ela foi preparada, mas **não executa backfill nem deploy
automaticamente**.

## Modelo

Cada documento `mesas/{mesaId}` passa a manter duas representações sincronizadas:

- `membroUids`: lista única de UIDs usada por consultas e autorização;
- `jogadores`: lista de `{ uid, nome }` usada pela interface.

Mesas novas começam com o mestre nas duas listas. A entrada por código usa
`arrayUnion` nos dois campos em uma única atualização. A remoção é feita em uma
transação e também limpa as duas listas, a iniciativa e o personagem do agente.

`buscarMinhasMesas` agora consulta somente:

```text
where('membroUids', 'array-contains', uid)
```

Não há mais leitura da coleção inteira. Uma mesa antiga sem `membroUids` precisa
ser migrada antes da publicação do novo cliente e das regras.

## O que as regras permitem

- leitura da mesa somente para UIDs presentes em `membroUids`;
- criação somente quando o usuário autenticado é o mestre e único membro inicial;
- entrada por código somente como uma adição exata do próprio UID e do próprio
  `{ uid, nome }`, sem alterar nenhum outro campo;
- edição geral, VTT, mestre, membros, expulsão e exclusão somente pelo mestre;
- iniciativa e demais estados compartilhados da mesa somente pelo mestre;
- personagens da mesa podem ser lidos e alterados somente pelo dono do documento
  (o ID é o UID) enquanto ele ainda for membro válido da mesa, ou pelo mestre
  válido da própria mesa;
- documentos pessoais em `users/{uid}` e descendentes somente pelo próprio usuário.

### Limitação conhecida da iniciativa

`iniciativas` ainda é um array dentro da mesa. Firestore Rules não consegue
autorizar com segurança apenas o elemento de um jogador sem permitir que ele
substitua o array completo. Por isso, a escrita é restrita ao mestre: cada jogador
rola os dados físicos e informa o total, e o mestre o registra na interface. Para
permitir escrita direta por agente no futuro, mova as entradas para uma
subcoleção com um documento por UID e deixe a ordenação como projeção da interface
ou do servidor.

### Impacto conhecido em personagens

Uma consulta à subcoleção inteira `mesas/{mesaId}/personagens` funciona para o
mestre, mas é negada para jogadores: regras não filtram resultados depois da
consulta. O cliente deste projeto já observa somente
`mesas/{mesaId}/personagens/{uidAtual}` quando a conta é de jogador. Caso a tela
precise futuramente mostrar dados públicos dos demais agentes, crie uma
subcoleção separada de resumos sem informações privadas.

A comparação do UID do documento não basta para conceder acesso: todas as
operações na ficha também consultam a mesa pai e exigem que a estrutura de
membros seja válida. Assim que um agente é removido de `membroUids`, ele deixa de
ler, recriar ou alterar a antiga ficha mesmo que um documento órfão permaneça.

## Backfill

O script [backfill-mesa-membership.mjs](../scripts/backfill-mesa-membership.mjs)
usa credenciais administrativas. Ele é conservador:

- o modo padrão é somente leitura;
- não corrige mestre ausente, jogador sem UID ou UID duplicado;
- não sobrescreve um `membroUids` já existente e divergente;
- em `--apply`, relê cada documento dentro de uma transação e só adiciona o campo
  quando ele ainda está ausente;
- exige repetir explicitamente o ID do projeto para permitir escrita.

Use um ambiente administrativo confiável. Nunca coloque uma chave de conta de
serviço no repositório. O pacote `firebase-admin` é necessário apenas nesse
ambiente e não foi adicionado às dependências da aplicação.

```powershell
# Instalação administrativa temporária; não altera package.json/package-lock.json
npm install --no-save --package-lock=false firebase-admin

# Credencial apontada somente na sessão atual do terminal
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\caminho-seguro\conta-servico.json'

# 1. Inspeção sem escrita
node .\scripts\backfill-mesa-membership.mjs --project SEU_PROJECT_ID

# 2. Escrita confirmada, depois de revisar o relatório
node .\scripts\backfill-mesa-membership.mjs --project SEU_PROJECT_ID --apply --confirm-project SEU_PROJECT_ID
```

O processo termina com código `2` quando encontra documentos bloqueados ou em
conflito. Corrija esses documentos manualmente e repita o modo de inspeção até o
relatório ficar sem bloqueios.

## Ordem de publicação

1. Faça um backup/exportação do Firestore.
2. Execute o backfill em modo de inspeção.
3. Resolva todos os documentos bloqueados ou conflitantes.
4. Execute o backfill com `--apply` e repita a inspeção.
5. Confirme que o cliente publicado mantém a leitura individual de personagem já implementada.
6. Valide as regras no Emulator Suite contra uma cópia de teste.
7. Publique `firestore.rules` explicitamente no projeto correto.
8. Publique o cliente que usa `membroUids`.

Exemplo de deploy manual, **não executado por este projeto**:

```powershell
npx firebase-tools deploy --only firestore:rules --project SEU_PROJECT_ID
```

Não inverta backfill e regras: mesas legadas deixam de ser legíveis assim que a
política nova entra em vigor.
