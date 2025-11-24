// src/lib/mesas.js
import { db } from './firebase';
import { 
  collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc, deleteDoc 
} from 'firebase/firestore';
import { ficha as FichaClass } from './personagem'; 

// --- MESAS ---

// Atualizado: Recebe o nome do mestre também
export async function criarMesa(nomeMesa, mestreUid, mestreNome) {
  const docRef = await addDoc(collection(db, "mesas"), {
    nome: nomeMesa,
    mestre: mestreUid,
    // O mestre entra automaticamente na lista de jogadores para aparecer na tela
    jogadores: [{ uid: mestreUid, nome: mestreNome || "Mestre" }], 
    dataCriacao: new Date().toISOString()
  });
  return docRef.id;
}

// Buscar Mesas (Lógica ajustada para ler objetos no array)
export async function buscarMinhasMesas(uid) {
  const mesas = [];
  
  // Mesas que mestro
  const qMestre = query(collection(db, "mesas"), where("mestre", "==", uid));
  const snapMestre = await getDocs(qMestre);
  snapMestre.forEach(doc => mesas.push({ id: doc.id, ...doc.data(), papel: 'mestre' }));

  // Mesas que jogo (pesquisa complexa em array de objetos não é direta no Firestore simples, 
  // então vamos buscar todas e filtrar no cliente por enquanto, ou manter a busca antiga se funcionar.
  // OBS: Firestore não busca facil dentro de array de objetos. 
  // TRUQUE: Vamos manter um array auxiliar de UIDs apenas para busca).
  
  // ... Para simplificar sem mudar a estrutura do banco drasticamente agora:
  // Vamos buscar todas as mesas e filtrar no javascript (não ideal para produção massiva, ok para agora)
  const snapTodas = await getDocs(collection(db, "mesas"));
  snapTodas.forEach(doc => {
      const data = doc.data();
      // Verifica se o UID está dentro de algum objeto do array jogadores
      const souJogador = data.jogadores.some(j => j.uid === uid);
      if (souJogador && data.mestre !== uid) {
          mesas.push({ id: doc.id, ...data, papel: 'jogador' });
      }
  });

  return mesas;
}

// Atualizado: Recebe o nome do jogador
export async function entrarNaMesa(mesaId, jogadorUid, jogadorNome) {
  const mesaRef = doc(db, "mesas", mesaId);
  const mesaSnap = await getDoc(mesaRef);

  if (!mesaSnap.exists()) throw new Error("Mesa não encontrada.");
  
  const dados = mesaSnap.data();
  const jaEsta = dados.jogadores.some(j => j.uid === jogadorUid);

  if (!jaEsta) {
      await updateDoc(mesaRef, {
        jogadores: arrayUnion({ uid: jogadorUid, nome: jogadorNome || "Agente Sem Nome" })
      });
  }
  
  return dados.nome;
}

// NOVO: Remover Jogador
export async function removerJogadorDaMesa(mesaId, jogadorUid) {
    const mesaRef = doc(db, "mesas", mesaId);
    const snap = await getDoc(mesaRef);
    if (!snap.exists()) return;
    
    const dados = snap.data();
    // Filtra removendo o jogador alvo
    const novaLista = dados.jogadores.filter(j => j.uid !== jogadorUid);
    
    await updateDoc(mesaRef, {
        jogadores: novaLista
    });
}

// --- PERSONAGENS ---
// (Mantido igual ao anterior)
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