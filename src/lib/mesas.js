// src/lib/mesas.js
import { db } from './firebase';
import { 
  collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc, deleteDoc 
} from 'firebase/firestore';
import { ficha as FichaClass } from './personagem'; 

// --- MESAS ---

export async function criarMesa(nome, mestreUid) {
  const docRef = await addDoc(collection(db, "mesas"), {
    nome: nome,
    mestre: mestreUid,
    jogadores: [],
    dataCriacao: new Date().toISOString()
  });
  return docRef.id;
}

export async function buscarMinhasMesas(uid) {
  const mesas = [];
  const qMestre = query(collection(db, "mesas"), where("mestre", "==", uid));
  const snapMestre = await getDocs(qMestre);
  snapMestre.forEach(doc => mesas.push({ id: doc.id, ...doc.data(), papel: 'mestre' }));

  const qJogador = query(collection(db, "mesas"), where("jogadores", "array-contains", uid));
  const snapJogador = await getDocs(qJogador);
  snapJogador.forEach(doc => mesas.push({ id: doc.id, ...doc.data(), papel: 'jogador' }));
  return mesas;
}

export async function entrarNaMesa(mesaId, jogadorUid) {
  const mesaRef = doc(db, "mesas", mesaId);
  const mesaSnap = await getDoc(mesaRef);
  if (!mesaSnap.exists()) throw new Error("Mesa não encontrada.");
  
  await updateDoc(mesaRef, {
    jogadores: arrayUnion(jogadorUid)
  });
  return mesaSnap.data().nome;
}

// --- PERSONAGENS NA MESA ---

export async function importarPersonagemParaMesa(mesaId, jogadorUid, dadosPersonagem) {
  // Salva na subcoleção da mesa. O ID do documento é o UID do jogador para garantir 1 char por mesa.
  const charRef = doc(db, "mesas", mesaId, "personagens", jogadorUid);
  
  const dadosFinais = dadosPersonagem || FichaClass.getDados();
  dadosFinais.info.jogador = jogadorUid; 
  
  // Usa setDoc para criar ou sobrescrever
  await setDoc(charRef, dadosFinais);
}

// --- PERSONAGENS PESSOAIS (NOVO) ---

export async function listarPersonagensPessoais(uid) {
  const lista = [];
  // Busca na subcoleção do usuário
  const q = query(collection(db, "users", uid, "personagens"));
  const snapshot = await getDocs(q);
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    lista.push({
      id: doc.id,
      nome: data.info?.nome || "Sem Nome",
      classe: data.info?.classe || "Desconhecido",
      nex: data.info?.nex || "0%",
      origem: data.info?.origem || "Desconhecido",
      dadosCompletos: data
    });
  });
  return lista;
}

export async function criarFichaPessoal(uid, dadosIniciais = null) {
  const dados = dadosIniciais || FichaClass.getDados();
  // Cria um novo documento com ID automático na subcoleção do usuário
  const docRef = await addDoc(collection(db, "users", uid, "personagens"), dados);
  return docRef.id;
}

export async function excluirFichaPessoal(uid, fichaId) {
  await deleteDoc(doc(db, "users", uid, "personagens", fichaId));
}