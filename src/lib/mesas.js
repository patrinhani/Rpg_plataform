// src/lib/mesas.js
import { db } from './firebase';
import {
  collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc, deleteDoc, runTransaction, serverTimestamp
} from 'firebase/firestore';

// CORREÇÃO AQUI: Importa a classe default, não a instância nomeada
import Personagem from './personagem'; 
import {
  criarIdEntidadeMesa,
  criarListaInicialIniciativa,
  removerParticipanteDaIniciativa,
  resolverNomeLegivelJogador,
} from './mesa-utils.js';
import {
  criarMembrosIniciais,
  obterMembrosMesa,
  obterPapelNaMesa,
  removerMembroDaMesa,
} from './mesa-membership.js';
import { normalizarCriaturaPersonalizada } from './custom-creatures.js';
export { vincularVttMesa } from './vtt-mesa-link.js';

// ... (Funções de Combate permanecem iguais: alternarCombate, avancarTurno, etc.) ...
// ... (Funções de Iniciativa permanecem iguais) ...

// ...

// --- PERSONAGENS ---

function normalizarDadosPersonagem(dadosPersonagem = null) {
  const personagem = new Personagem();
  if (dadosPersonagem) personagem.carregarDados(dadosPersonagem);
  personagem.calcularValoresMaximos();
  return personagem.getDados();
}

export async function importarPersonagemParaMesa(mesaId, jogadorUid, dadosPersonagem, jogadorNome = '') {
  const charRef = doc(db, "mesas", mesaId, "personagens", jogadorUid);

  const dadosFinais = normalizarDadosPersonagem(dadosPersonagem);
  if (!dadosPersonagem) dadosFinais.info.criacao_em_andamento = true;
  dadosFinais.info.jogador = resolverNomeLegivelJogador(
    jogadorUid,
    jogadorNome,
    dadosFinais.info.jogador,
  );
  await setDoc(charRef, dadosFinais);
}

export async function listarPersonagensPessoais(uid) {
  const lista = [];
  const q = query(collection(db, "users", uid, "personagens"));
  const snapshot = await getDocs(q);
  snapshot.forEach((doc) => {
    const data = doc.data();
    lista.push({
      id: doc.id,
      nome: data.info?.nome || "Sem Nome",
      classe: data.info?.classe || "Desconhecido",
      nex: data.info?.nex || "0%",
      dadosCompletos: data
    });
  });
  return lista;
}

export async function criarFichaPessoal(uid, dadosIniciais = null) {
  const dados = normalizarDadosPersonagem(dadosIniciais);
  if (!dadosIniciais) dados.info.criacao_em_andamento = true;

  const docRef = await addDoc(collection(db, "users", uid, "personagens"), dados);
  return docRef.id;
}

export async function excluirFichaPessoal(uid, fichaId) {
  await deleteDoc(doc(db, "users", uid, "personagens", fichaId));
}

// ... (Restante das funções de Gerenciamento de Mesa: criarMesa, buscarMinhasMesas, etc. permanecem iguais) ...
// Vou incluir o arquivo completo abaixo para garantir que não falte nada.

// --- COMBATE E INICIATIVA (Mantidos para contexto) ---
export async function alternarCombate(mesaId, status, jogadoresAtuais = []) {
    const mesaRef = doc(db, "mesas", mesaId);
    const updateData = { 
        emCombate: status,
        turnoAtual: 0,
        rodada: 1
    };

    if (status === true) {
        const snap = await getDoc(mesaRef);
        if (!snap.exists()) throw new Error("Mesa não encontrada.");
        updateData.iniciativas = criarListaInicialIniciativa(jogadoresAtuais, snap.data().mestre);
    } else {
        updateData.iniciativas = [];
    }
    
    await updateDoc(mesaRef, updateData);
}

export async function avancarTurno(mesaId, indiceAtual, totalParticipantes) {
    const mesaRef = doc(db, "mesas", mesaId);
    const snap = await getDoc(mesaRef);
    if(!snap.exists()) return;

    const dados = snap.data();
    let novoIndice = indiceAtual + 1;
    let novaRodada = dados.rodada || 1;

    if (novoIndice >= totalParticipantes) {
        novoIndice = 0;
        novaRodada++;
    }

    await updateDoc(mesaRef, { 
        turnoAtual: novoIndice,
        rodada: novaRodada
    });
}

export async function atualizarIniciativa(mesaId, uid, nome, valor) {
    const mesaRef = doc(db, "mesas", mesaId);
    const snap = await getDoc(mesaRef);
    if (!snap.exists()) return;

    const dados = snap.data();
    let lista = dados.iniciativas || [];

    const index = lista.findIndex(i => i.uid === uid);
    
    if (index >= 0) {
        lista[index].valor = parseInt(valor);
    } else {
        lista.push({ uid, nome, valor: parseInt(valor), isNPC: false });
    }

    lista.sort((a, b) => b.valor - a.valor);

    await updateDoc(mesaRef, { iniciativas: lista });
}

export async function adicionarNPCIniciativa(mesaId, nomeNPC, valor, pvMax = 10) {
    const mesaRef = doc(db, "mesas", mesaId);
    const snap = await getDoc(mesaRef);
    if (!snap.exists()) return;

    const dados = snap.data();
    let lista = dados.iniciativas || [];

    lista.push({ 
        uid: criarIdEntidadeMesa('npc'),
        nome: nomeNPC, 
        valor: parseInt(valor), 
        isNPC: true,
        pv_atual: parseInt(pvMax),
        pv_max: parseInt(pvMax),
        san_atual: 0,
        pe_atual: 0
    });

    lista.sort((a, b) => b.valor - a.valor);
    await updateDoc(mesaRef, { iniciativas: lista });
}

export async function adicionarMonstroIniciativa(mesaId, monstroData, iniciativaRolada) {
    const mesaRef = doc(db, "mesas", mesaId);
    const snap = await getDoc(mesaRef);
    if (!snap.exists()) return;

    const dados = snap.data();
    let lista = dados.iniciativas || [];

    lista.push({
        uid: criarIdEntidadeMesa('monster'),
        nome: monstroData.nome,
        valor: parseInt(iniciativaRolada) || 0,
        isNPC: true,
        isMonster: true,
        pv_atual: monstroData.pv_max,
        pv_max: monstroData.pv_max,
        fichaCompleta: monstroData 
    });

    lista.sort((a, b) => b.valor - a.valor);
    await updateDoc(mesaRef, { iniciativas: lista });
}

export async function salvarCriaturaPersonalizada(mesaId, criaturaData) {
    const criatura = normalizarCriaturaPersonalizada(criaturaData, criaturaData?.id);
    const criaturaRef = doc(db, 'mesas', mesaId, 'criaturas', criatura.id);
    await setDoc(criaturaRef, { ...criatura, atualizadaEm: serverTimestamp() });
    return criatura;
}

export async function removerCriaturaPersonalizada(mesaId, criaturaId) {
    if (!/^criatura_[a-zA-Z0-9_-]{8,90}$/.test(String(criaturaId || ''))) {
      throw new Error('Identificador de criatura personalizado inválido.');
    }
    await deleteDoc(doc(db, 'mesas', mesaId, 'criaturas', criaturaId));
}

export async function atualizarNPCStatus(mesaId, uidNPC, campo, valor) {
    const mesaRef = doc(db, "mesas", mesaId);
    const snap = await getDoc(mesaRef);
    if (!snap.exists()) return;

    const lista = snap.data().iniciativas.map(i => {
        if (i.uid === uidNPC && i.isNPC) {
            return { ...i, [campo]: parseInt(valor) };
        }
        return i;
    });

    await updateDoc(mesaRef, { iniciativas: lista });
}

export async function removerDaIniciativa(mesaId, uidAlvo) {
    const mesaRef = doc(db, "mesas", mesaId);

    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(mesaRef);
        if (!snap.exists()) return;

        const dados = snap.data();
        const listaAtual = Array.isArray(dados.iniciativas) ? dados.iniciativas : [];
        const resultado = removerParticipanteDaIniciativa(
            listaAtual,
            uidAlvo,
            dados.turnoAtual,
        );

        if (resultado.iniciativas.length === listaAtual.length) return;

        transaction.update(mesaRef, {
            iniciativas: resultado.iniciativas,
            turnoAtual: resultado.turnoAtual
        });
    });
}

// --- GERENCIAMENTO DE MESA ---

export async function criarMesa(nomeMesa, mestreUid, mestreNome) {
  const membroUids = criarMembrosIniciais(mestreUid);
  const uidMestre = membroUids[0];
  const nomeMestre = String(mestreNome || '').trim().slice(0, 80) || "Mestre";
  const nome = String(nomeMesa || '').trim().slice(0, 80);
  if (!nome) throw new Error('Informe um nome para a mesa.');
  const docRef = await addDoc(collection(db, "mesas"), {
    nome,
    mestre: uidMestre,
    membroUids,
    jogadores: [{ uid: uidMestre, nome: nomeMestre }],
    dataCriacao: new Date().toISOString(),
    emCombate: false,
    iniciativas: []
  });
  return docRef.id;
}

export async function buscarMinhasMesas(uid) {
  const uidNormalizado = String(uid || '').trim();
  if (!uidNormalizado) throw new Error('Usuário inválido para buscar mesas.');
  const mesas = [];
  const qMembro = query(collection(db, "mesas"), where("membroUids", "array-contains", uidNormalizado));
  const snapshot = await getDocs(qMembro);
  snapshot.forEach(documento => {
      const data = documento.data();
      const papel = obterPapelNaMesa(data, uidNormalizado);
      if (!papel) {
          throw new Error(`A mesa ${documento.id} possui uma lista de membros inconsistente.`);
      }
      mesas.push({ id: documento.id, ...data, papel });
  });
  return mesas;
}

export async function entrarNaMesa(mesaId, jogadorUid, jogadorNome) {
  const idMesa = String(mesaId || '').trim();
  const uid = String(jogadorUid || '').trim();
  const nome = String(jogadorNome || '').trim().slice(0, 80) || "Agente";
  if (!idMesa) throw new Error('Código da mesa inválido.');
  if (!uid) throw new Error('Usuário inválido para entrar na mesa.');
  const mesaRef = doc(db, "mesas", idMesa);

  try {
    // O primeiro acesso é intencionalmente cego: pelas regras seguras, quem ainda
    // não é membro não pode ler a mesa. arrayUnion mantém a adesão atômica.
    await updateDoc(mesaRef, {
      membroUids: arrayUnion(uid),
      jogadores: arrayUnion({ uid, nome }),
    });
  } catch (erroEntrada) {
    // Um membro existente pode repetir o convite com outro nome. Nesse caso as
    // regras recusam alterar jogadores, mas a leitura posterior confirma o acesso.
    try {
      const snapshotExistente = await getDoc(mesaRef);
      if (snapshotExistente.exists()) {
        const dadosExistentes = snapshotExistente.data();
        if (obterMembrosMesa(dadosExistentes).includes(uid)) return dadosExistentes.nome;
      }
    } catch {
      // Mantém abaixo uma mensagem única que não revela mesas privadas.
    }

    const erro = new Error(
      'Não foi possível entrar na mesa. Confira o convite. Se a mesa for antiga, o mestre precisa executar o backfill de membroUids.',
    );
    erro.cause = erroEntrada;
    throw erro;
  }

  const mesaSnap = await getDoc(mesaRef);
  if (!mesaSnap.exists()) throw new Error("Mesa não encontrada.");
  const dados = mesaSnap.data();
  if (!obterMembrosMesa(dados).includes(uid)) {
    throw new Error('A entrada foi registrada, mas a associação à mesa não pôde ser confirmada.');
  }
  return dados.nome;
}

export async function removerJogadorDaMesa(mesaId, jogadorUid) {
    const mesaRef = doc(db, "mesas", mesaId);
    const personagemRef = doc(db, "mesas", mesaId, "personagens", jogadorUid);

    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(mesaRef);
        if (!snap.exists()) return;

        const dados = snap.data();
        if (dados.mestre === jogadorUid) {
            throw new Error("O mestre não pode ser removido da própria mesa.");
        }

        const jogadores = Array.isArray(dados.jogadores) ? dados.jogadores : [];
        const resultado = removerParticipanteDaIniciativa(
            dados.iniciativas,
            jogadorUid,
            dados.turnoAtual,
        );

        transaction.update(mesaRef, {
            membroUids: removerMembroDaMesa(dados, jogadorUid),
            jogadores: jogadores.filter(jogador => jogador.uid !== jogadorUid),
            iniciativas: resultado.iniciativas,
            turnoAtual: resultado.turnoAtual
        });
        transaction.delete(personagemRef);
    });
}

export async function excluirMesaCompleta(mesaId) {
    const charsQ = query(collection(db, "mesas", mesaId, "personagens"));
    const charsSnap = await getDocs(charsQ);
    const deletePromises = charsSnap.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    await deleteDoc(doc(db, "mesas", mesaId));
}

export async function atualizarNomeMesa(mesaId, novoNome) {
    const nome = String(novoNome || '').trim().slice(0, 80);
    if (!nome) throw new Error('Informe um nome para a mesa.');
    await updateDoc(doc(db, "mesas", mesaId), { nome });
}
