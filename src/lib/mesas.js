// src/lib/mesas.js
import { db } from './firebase';
import { 
  collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc, deleteDoc 
} from 'firebase/firestore';
import { ficha as FichaClass } from './personagem'; 

// --- COMBATE E INICIATIVA ---

export async function alternarCombate(mesaId, status, jogadoresAtuais = []) {
    const mesaRef = doc(db, "mesas", mesaId);
    const updateData = { 
        emCombate: status,
        turnoAtual: 0,
        rodada: 1
    };

    if (status === true) {
        const listaInicial = jogadoresAtuais.map(j => ({
            uid: j.uid,
            nome: j.nome,
            valor: 0,
            isNPC: false
        }));
        updateData.iniciativas = listaInicial;
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

// Adiciona NPC Genérico
export async function adicionarNPCIniciativa(mesaId, nomeNPC, valor, pvMax = 10) {
    const mesaRef = doc(db, "mesas", mesaId);
    const snap = await getDoc(mesaRef);
    if (!snap.exists()) return;

    const dados = snap.data();
    let lista = dados.iniciativas || [];

    lista.push({ 
        uid: `npc_${Date.now()}`, 
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

// Adiciona Monstro do Bestiário
export async function adicionarMonstroIniciativa(mesaId, monstroData, iniciativaRolada) {
    const mesaRef = doc(db, "mesas", mesaId);
    const snap = await getDoc(mesaRef);
    if (!snap.exists()) return;

    const dados = snap.data();
    let lista = dados.iniciativas || [];

    lista.push({
        uid: `monster_${Date.now()}`, 
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
    const snap = await getDoc(mesaRef);
    if (!snap.exists()) return;

    const dados = snap.data();
    const novaLista = (dados.iniciativas || []).filter(i => i.uid !== uidAlvo);
    
    await updateDoc(mesaRef, { iniciativas: novaLista });
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
    const snap = await getDoc(mesaRef);
    if (!snap.exists()) return;
    const dados = snap.data();
    const novaLista = dados.jogadores.filter(j => j.uid !== jogadorUid);
    await updateDoc(mesaRef, { jogadores: novaLista });
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

// --- PERSONAGENS ---

export async function importarPersonagemParaMesa(mesaId, jogadorUid, dadosPersonagem) {
  const charRef = doc(db, "mesas", mesaId, "personagens", jogadorUid);
  const dadosFinais = dadosPersonagem || FichaClass.getDados();
  dadosFinais.info.jogador = jogadorUid; 
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
  const dados = dadosIniciais || FichaClass.getDados();
  const docRef = await addDoc(collection(db, "users", uid, "personagens"), dados);
  return docRef.id;
}

export async function excluirFichaPessoal(uid, fichaId) {
  await deleteDoc(doc(db, "users", uid, "personagens", fichaId));
}