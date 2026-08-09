// src/pages/Dashboard/index.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom'; 
import { useDialog } from '../../contexts/DialogContext'; 
import { criarMesa, buscarMinhasMesas, entrarNaMesa, listarPersonagensPessoais, criarFichaPessoal, excluirFichaPessoal } from '../../lib/mesas';

// --- IMPORTS DO FIREBASE ---
import { db } from '../../lib/firebase'; 
import { collection, addDoc } from 'firebase/firestore';
import Personagem from '../../lib/personagem.js';
import { parsearFichaJson, validarTamanhoArquivoFicha } from '../../lib/importacaoFicha.js';
import ElementRail from '../../components/ElementRail.jsx';
import { AppIcon } from '../../components/icons/NavigationIcons.jsx';

export default function Dashboard() {
  const { usuario, logout, devVisualMode } = useAuth();
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useDialog(); 
  
  const [mesas, setMesas] = useState([]);
  const [fichasPessoais, setFichasPessoais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  
  const [showCriarMesa, setShowCriarMesa] = useState(false);
  const [showEntrarMesa, setShowEntrarMesa] = useState(false);
  const [inputNomeMesa, setInputNomeMesa] = useState('');
  const [inputCodigoMesa, setInputCodigoMesa] = useState('');

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    if (devVisualMode) {
      setMesas([]);
      setFichasPessoais([{
        id: 'codex-demo',
        info: { nome: 'Agente Visual', classe: 'Especialista', nex: '40%' },
        nome: 'Agente Visual',
        classe: 'Especialista',
        nex: '40%',
      }]);
      setLoading(false);
      return;
    }

    try {
      const [resultadoMesas, resultadoFichas] = await Promise.allSettled([
        buscarMinhasMesas(usuario.uid),
        listarPersonagensPessoais(usuario.uid)
      ]);

      if (resultadoMesas.status === 'fulfilled') {
        setMesas(resultadoMesas.value);
      } else {
        setMesas([]);
        console.error('Falha ao sincronizar Mesas:', resultadoMesas.reason);
      }

      if (resultadoFichas.status === 'fulfilled') {
        setFichasPessoais(resultadoFichas.value);
      } else {
        setFichasPessoais([]);
        console.error('Falha ao sincronizar fichas pessoais:', resultadoFichas.reason);
      }

      if (resultadoMesas.status === 'rejected' && resultadoFichas.status === 'rejected') {
        setLoadError('Não foi possível sincronizar suas mesas e fichas.');
      } else if (resultadoMesas.status === 'rejected') {
        setLoadError('Suas fichas foram carregadas, mas não foi possível sincronizar as mesas.');
      } else if (resultadoFichas.status === 'rejected') {
        setLoadError('Suas mesas foram carregadas, mas não foi possível sincronizar as fichas.');
      }
    } catch (error) {
      console.error(error);
      setLoadError('Não foi possível sincronizar suas mesas e fichas.');
    } finally {
      setLoading(false);
    }
  }, [usuario, devVisualMode]);

  // --- CARREGAMENTO DE DADOS ---
  useEffect(() => {
    if (usuario) carregarDados();
  }, [usuario, carregarDados]);

  useEffect(() => {
    document.title = 'C.A.O.S — Painel do Agente';
  }, []);

  // --- AÇÕES DE MESA ---
  const handleCriarMesa = async () => {
    if (!inputNomeMesa) return;
    try {
      const novoId = await criarMesa(inputNomeMesa, usuario.uid, usuario.displayName);
      setInputNomeMesa(''); setShowCriarMesa(false);
      navigate(`/mesa/${novoId}`);
    } catch (e) { 
        showAlert("Erro ao criar mesa: " + e.message, "Erro"); 
    }
  };

  const handleEntrarMesa = async () => {
    if (!inputCodigoMesa) return;
    try {
      await entrarNaMesa(inputCodigoMesa, usuario.uid, usuario.displayName);
      navigate(`/mesa/${inputCodigoMesa}`);
    } catch (e) { 
        showAlert(e.message, "Erro"); 
    }
  };

  // --- AÇÕES DE FICHA ---
  const handleCriarFicha = async () => {
    if (devVisualMode) {
      navigate('/ficha/codex-demo');
      return;
    }

    setLoading(true);
    try {
      const novoId = await criarFichaPessoal(usuario.uid);
      navigate(`/ficha/${novoId}`);
    } catch (error) {
      console.error(error);
      showAlert(`Não foi possível criar a ficha: ${error.message}`, 'Erro');
      setLoading(false);
    }
  };

  const handleExcluirFicha = async (e, id) => {
    e.stopPropagation();
    const confirmado = await showConfirm("Excluir esta ficha permanentemente? Essa ação não pode ser desfeita.", "Excluir Ficha");
    if(confirmado) {
        try {
          await excluirFichaPessoal(usuario.uid, id);
          await carregarDados();
        } catch (error) {
          console.error(error);
          showAlert(`Não foi possível excluir a ficha: ${error.message}`, 'Erro');
        }
    }
  };

  // --- FUNÇÃO DE IMPORTAR JSON ---
  const handleImportarFicha = async (event) => {
    const inputArquivo = event.currentTarget;
    const file = inputArquivo.files?.[0];
    inputArquivo.value = '';
    if (!file) return;

    try {
      validarTamanhoArquivoFicha(file.size);
      setLoading(true);

      const jsonContent = parsearFichaJson(await file.text());
      const nomeLido = typeof jsonContent.info.nome === 'string' && jsonContent.info.nome.trim()
        ? jsonContent.info.nome.trim()
        : 'Sem Nome';

      const personagemImportado = new Personagem();
      personagemImportado.carregarDados(jsonContent);
      personagemImportado.calcularValoresMaximos();

      // Normaliza versões antigas sem descartar campos atuais da ficha.
      const novaFicha = {
          ...personagemImportado.getDados(),
          uid: usuario.uid,
          dono: usuario.displayName,
          dataCriacao: new Date().toISOString(),
      };

      // Salva na subcoleção do usuário para aparecer na lista correta
      const colecaoDestino = collection(db, "users", usuario.uid, "personagens");
      await addDoc(colecaoDestino, novaFicha);

      showAlert(`Ficha "${nomeLido}" importada com sucesso!`, "Sucesso");
      await carregarDados();
    } catch (error) {
      console.error("Erro ao importar:", error);
      showAlert("Erro ao processar o arquivo: " + error.message, "Erro");
    } finally {
      setLoading(false);
    }
  };

  const nomeAgente = usuario?.displayName || 'Agente';
  const statusSincronizacao = loadError
    ? 'Indisponível'
    : (loading ? 'Sincronizando' : (devVisualMode ? 'Visual' : 'Online'));
  const descricaoSincronizacao = loadError
    ? 'Sincronização indisponível'
    : (loading ? 'Sincronizando dados' : (devVisualMode ? 'Ambiente visual local' : 'Conexão segura ativa'));
  const resumoOperacional = [
    { label: 'Missões', valor: mesas.length },
    { label: 'Fichas', valor: fichasPessoais.length },
    { label: 'Sincronização', valor: statusSincronizacao },
  ];

  return (
    <div className="convergence-page dashboard-page">
      <div className="dashboard-ambient-art" aria-hidden="true">
        <img src="/assets/images/optimized/Character-1280.webp" alt="" decoding="async" />
      </div>

      <ElementRail variante="dashboard" temaAtual="tema-ordem" />

      <main className="dashboard-workspace" aria-busy={loading}>
        <header className="dashboard-topbar">
          <div className="dashboard-heading">
            <span className="convergence-eyebrow">Central de operações</span>
            <h1>Painel do Agente</h1>
          </div>

          <div className="dashboard-agent-profile">
            <span className={`dashboard-online-dot ${loadError ? 'is-error' : ''} ${loading ? 'is-loading' : ''}`} aria-hidden="true"></span>
            <div>
              <strong>{nomeAgente}</strong>
              <small>{descricaoSincronizacao}</small>
            </div>
            <button type="button" onClick={logout} className="convergence-icon-button dashboard-logout" aria-label="Sair">
              <AppIcon name="logout" size={17} />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {loadError && (
          <div className="dashboard-sync-error" role="alert">
            <span>{loadError}</span>
            <button type="button" onClick={carregarDados}>Tentar novamente</button>
          </div>
        )}

        <section className="dashboard-overview" aria-label="Resumo operacional">
          <article className="convergence-panel dashboard-hero-panel">
            <div className="dashboard-hero-copy">
              <span className="convergence-eyebrow">Agente conectado</span>
              <h2>{nomeAgente}</h2>
              <p>Gerencie suas missões, agentes e registros a partir de um único núcleo operacional.</p>
              <div className="dashboard-metrics">
                {resumoOperacional.map(item => (
                  <div className="dashboard-metric" key={item.label}>
                    <strong>{item.valor}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="dashboard-hero-emblem" aria-hidden="true">
              <span className="dashboard-orbit dashboard-orbit--outer"></span>
              <span className="dashboard-orbit dashboard-orbit--inner"></span>
              <img src="/assets/images/optimized/SimboloSemafinidade-320.webp" alt="" />
            </div>
          </article>

          <aside className="convergence-panel dashboard-quick-panel">
            <div className="convergence-section-heading">
              <div>
                <span className="convergence-eyebrow">Comandos</span>
                <h2>Ações rápidas</h2>
              </div>
            </div>
            <div className="dashboard-quick-grid">
              <button
                type="button"
                onClick={() => {
                  setShowCriarMesa(prev => !prev);
                  setShowEntrarMesa(false);
                }}
                className={showCriarMesa ? 'active' : ''}
              >
                <AppIcon name="mission" size={22} />
                <span>Criar mesa</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEntrarMesa(prev => !prev);
                  setShowCriarMesa(false);
                }}
                className={showEntrarMesa ? 'active' : ''}
              >
                <AppIcon name="code" size={22} />
                <span>Entrar com código</span>
              </button>
              <button type="button" onClick={handleCriarFicha}>
                <AppIcon name="user" size={22} />
                <span>Nova ficha</span>
              </button>
              <label className="dashboard-quick-upload">
                <AppIcon name="export" size={22} />
                <span>Importar JSON</span>
                <input type="file" accept=".json" onChange={handleImportarFicha} />
              </label>
            </div>
          </aside>
        </section>

        {(showCriarMesa || showEntrarMesa) && (
          <section className="convergence-panel dashboard-command-panel" aria-label="Comando de mesa">
            {showCriarMesa && (
              <form onSubmit={(event) => { event.preventDefault(); handleCriarMesa(); }}>
                <label htmlFor="dashboard-nome-mesa">Nome da nova missão</label>
                <input id="dashboard-nome-mesa" type="text" maxLength={80} placeholder="Ex.: Ecos do Abismo" value={inputNomeMesa} onChange={event => setInputNomeMesa(event.target.value)} />
                <button type="submit">Criar mesa</button>
              </form>
            )}
            {showEntrarMesa && (
              <form onSubmit={(event) => { event.preventDefault(); handleEntrarMesa(); }}>
                <label htmlFor="dashboard-codigo-mesa">Código da mesa</label>
                <input id="dashboard-codigo-mesa" type="text" placeholder="Informe o código recebido" value={inputCodigoMesa} onChange={event => setInputCodigoMesa(event.target.value)} />
                <button type="submit">Entrar na mesa</button>
              </form>
            )}
          </section>
        )}

        <section className="dashboard-content-grid">
          <article className="convergence-panel dashboard-section dashboard-missions-panel">
            <div className="convergence-section-heading">
              <div>
                <span className="convergence-eyebrow">Operações compartilhadas</span>
                <h2>Missões</h2>
              </div>
              <span className="convergence-count">{mesas.length}</span>
            </div>

            <div className="dashboard-grid dashboard-mission-grid">
              {mesas.map(mesa => (
                <button
                  type="button"
                  key={mesa.id}
                  className={`dashboard-card dashboard-mission-card ${mesa.papel === 'mestre' ? 'is-master' : ''}`}
                  onClick={() => navigate(`/mesa/${mesa.id}`)}
                >
                  <span className="dashboard-card-icon"><AppIcon name="mission" size={22} /></span>
                  <span className="dashboard-card-copy">
                    <strong>{mesa.nome}</strong>
                    <small>{mesa.papel === 'mestre' ? 'Mestre da operação' : 'Agente de campo'}</small>
                  </span>
                  <span className="dashboard-card-arrow" aria-hidden="true">›</span>
                </button>
              ))}
              {mesas.length === 0 && !loading && !loadError && (
                <div className="estado-vazio dashboard-empty-state">
                  <AppIcon name="mission" size={26} />
                  <strong>Nenhuma missão em andamento</strong>
                  <span>Crie uma mesa ou entre usando um código.</span>
                </div>
              )}
            </div>
          </article>

          <article className="convergence-panel dashboard-section dashboard-sheets-panel">
            <div className="convergence-section-heading">
              <div>
                <span className="convergence-eyebrow">Arquivo pessoal</span>
                <h2>Fichas de agente</h2>
              </div>
              <span className="convergence-count">{fichasPessoais.length}</span>
            </div>

            <div className="dashboard-grid dashboard-agent-grid">
              {fichasPessoais.map(ficha => {
                const nomePersonagem = ficha.info?.nome || ficha.nome || 'Sem Nome';
                const classePersonagem = ficha.info?.classe || ficha.classe || 'Mundano';
                const nexPersonagem = ficha.info?.nex || ficha.nex || '0%';
                const fotoPersonagem = ficha.info?.foto || ficha.dadosCompletos?.info?.foto || ficha.foto;

                return (
                  <article key={ficha.id} className="dashboard-card dashboard-agent-card">
                    <button type="button" className="dashboard-card-open" onClick={() => navigate(`/ficha/${ficha.id}`)}>
                      <span className="dashboard-agent-avatar" style={fotoPersonagem ? { backgroundImage: `url(${fotoPersonagem})` } : undefined}>
                        {!fotoPersonagem && <AppIcon name="user" size={22} />}
                      </span>
                      <span className="dashboard-card-copy">
                        <strong>{nomePersonagem}</strong>
                        <small>{classePersonagem} · NEX {nexPersonagem}</small>
                      </span>
                      <span className="dashboard-card-arrow" aria-hidden="true">›</span>
                    </button>
                    <button
                      type="button"
                      className="btn-excluir-card"
                      onClick={(event) => handleExcluirFicha(event, ficha.id)}
                      aria-label={`Excluir ficha de ${nomePersonagem}`}
                    >
                      &times;
                    </button>
                  </article>
                );
              })}
              {fichasPessoais.length === 0 && !loading && !loadError && (
                <div className="estado-vazio dashboard-empty-state">
                  <AppIcon name="user" size={26} />
                  <strong>Nenhuma ficha criada</strong>
                  <span>Crie seu primeiro agente para iniciar.</span>
                </div>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
