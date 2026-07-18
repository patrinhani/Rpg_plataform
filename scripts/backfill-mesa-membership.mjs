#!/usr/bin/env node

import process from 'node:process';
import { pathToFileURL } from 'node:url';

function uidValido(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function conjuntosIguais(a, b) {
  return a.length === b.length && a.every(valor => b.includes(valor));
}

export function planejarBackfillMesa(dados = {}) {
  const mestre = uidValido(dados.mestre) ? dados.mestre.trim() : '';
  if (!mestre) return { status: 'bloqueada', motivo: 'mestre ausente ou inválido' };
  if (!Array.isArray(dados.jogadores)) {
    return { status: 'bloqueada', motivo: 'jogadores não é uma lista' };
  }

  const membroUids = [];
  for (const jogador of dados.jogadores) {
    const uid = uidValido(jogador?.uid) ? jogador.uid.trim() : '';
    if (!uid) return { status: 'bloqueada', motivo: 'jogador sem UID válido' };
    if (membroUids.includes(uid)) {
      return { status: 'bloqueada', motivo: `UID duplicado em jogadores: ${uid}` };
    }
    membroUids.push(uid);
  }

  if (!membroUids.includes(mestre)) {
    return { status: 'bloqueada', motivo: 'o mestre não está em jogadores' };
  }

  if (dados.membroUids !== undefined) {
    if (!Array.isArray(dados.membroUids) || dados.membroUids.some(uid => !uidValido(uid))) {
      return { status: 'conflito', motivo: 'membroUids existente é inválido' };
    }
    const existentes = dados.membroUids.map(uid => uid.trim());
    if (new Set(existentes).size !== existentes.length || !conjuntosIguais(existentes, membroUids)) {
      return { status: 'conflito', motivo: 'membroUids existente diverge de jogadores' };
    }
    return { status: 'inalterada', membroUids };
  }

  return { status: 'pendente', membroUids };
}

function lerArgumentos(argv) {
  const argumentos = { aplicar: false, projeto: '', confirmacao: '', ajuda: false };
  for (let indice = 0; indice < argv.length; indice += 1) {
    const argumento = argv[indice];
    if (argumento === '--apply') argumentos.aplicar = true;
    else if (argumento === '--help' || argumento === '-h') argumentos.ajuda = true;
    else if (argumento === '--project') argumentos.projeto = argv[++indice] || '';
    else if (argumento === '--confirm-project') argumentos.confirmacao = argv[++indice] || '';
    else throw new Error(`Argumento desconhecido: ${argumento}`);
  }
  return argumentos;
}

function mostrarAjuda() {
  console.log(`Uso:
  node scripts/backfill-mesa-membership.mjs --project ID
  node scripts/backfill-mesa-membership.mjs --project ID --apply --confirm-project ID

Sem --apply o script apenas inspeciona. Em modo de escrita, cada mesa é relida em
uma transação e somente documentos ainda sem membroUids são atualizados.`);
}

async function executar() {
  const argumentos = lerArgumentos(process.argv.slice(2));
  if (argumentos.ajuda) {
    mostrarAjuda();
    return;
  }
  if (!argumentos.projeto) throw new Error('Informe o projeto com --project ID.');
  if (argumentos.aplicar && argumentos.confirmacao !== argumentos.projeto) {
    throw new Error('Para escrever, repita o ID em --confirm-project ID.');
  }

  let adminApp;
  let adminFirestore;
  try {
    [adminApp, adminFirestore] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/firestore'),
    ]);
  } catch (erro) {
    throw new Error(
      'firebase-admin não está disponível. Instale-o apenas no ambiente administrativo antes de executar o backfill.',
      { cause: erro },
    );
  }

  const app = adminApp.initializeApp({
    credential: adminApp.applicationDefault(),
    projectId: argumentos.projeto,
  }, `backfill-membros-${Date.now()}`);
  const banco = adminFirestore.getFirestore(app);
  const snapshot = await banco.collection('mesas').get();
  const resumo = { pendente: 0, inalterada: 0, bloqueada: 0, conflito: 0, aplicada: 0 };

  for (const documento of snapshot.docs) {
    const plano = planejarBackfillMesa(documento.data());
    resumo[plano.status] += 1;
    if (plano.status === 'bloqueada' || plano.status === 'conflito') {
      console.error(`[${plano.status}] ${documento.id}: ${plano.motivo}`);
      continue;
    }
    if (plano.status !== 'pendente' || !argumentos.aplicar) continue;

    const aplicada = await banco.runTransaction(async transacao => {
      const atual = await transacao.get(documento.ref);
      if (!atual.exists) return false;
      const planoAtual = planejarBackfillMesa(atual.data());
      if (planoAtual.status !== 'pendente') return false;
      transacao.update(documento.ref, { membroUids: planoAtual.membroUids });
      return true;
    });
    if (aplicada) resumo.aplicada += 1;
  }

  console.log(JSON.stringify({ projeto: argumentos.projeto, modo: argumentos.aplicar ? 'apply' : 'dry-run', ...resumo }, null, 2));
  if (resumo.bloqueada > 0 || resumo.conflito > 0) process.exitCode = 2;
}

const executadoDiretamente = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (executadoDiretamente) {
  executar().catch(erro => {
    console.error(`Backfill não executado: ${erro.message}`);
    process.exitCode = 1;
  });
}
