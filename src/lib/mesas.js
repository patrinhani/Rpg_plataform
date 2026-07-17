// src/lib/mesas.js
import { db } from './firebase';
import { 
  collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc, deleteDoc, runTransaction
} from 'firebase/firestore';

// CORREÇÃO AQUI: Importa a classe default, não a instância nomeada
import Personagem from './personagem'; 
import {
  criarIdEntidadeMesa,
  criarListaInicialIniciativa,
  removerParticipanteDaIniciativa,
  resolverNomeLegivelJogador,
} from './mesa-utils.js';

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
  const docRef = await addDoc(collection(db, "mesas"), {
    nome: nomeMesa,
    mestre: mestreUid,
    jogadores: [{ uid: mestreUid, nome: mestreNome || "Mestre" }], 
    dataCriacao: new Date().toISOString(),
    emCombate: false,
    iniciativas: []
  });
  return docRef.id;
}

export async function buscarMinhasMesas(uid) {
  const mesas = [];
  const qMestre = query(collection(db, "mesas"), where("mestre", "==", uid));
  const snapMestre = await getDocs(qMestre);
  snapMestre.forEach(doc => mesas.push({ id: doc.id, ...doc.data(), papel: 'mestre' }));

  const snapTodas = await getDocs(collection(db, "mesas"));
  snapTodas.forEach(doc => {
      const data = doc.data();
      const souJogador = data.jogadores && data.jogadores.some(j => j.uid === uid);
      if (souJogador && data.mestre !== uid) {
          mesas.push({ id: doc.id, ...data, papel: 'jogador' });
      }
  });
  return mesas;
}

export async function entrarNaMesa(mesaId, jogadorUid, jogadorNome) {
  const mesaRef = doc(db, "mesas", mesaId);
  const mesaSnap = await getDoc(mesaRef);
  if (!mesaSnap.exists()) throw new Error("Mesa não encontrada.");
  
  const dados = mesaSnap.data();
  const jaEsta = dados.jogadores.some(j => j.uid === jogadorUid);
  if (!jaEsta) {
      await updateDoc(mesaRef, {
        jogadores: arrayUnion({ uid: jogadorUid, nome: jogadorNome || "Agente" })
      });
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
    await updateDoc(doc(db, "mesas", mesaId), { nome: novoNome });
}
