// /src/components/ficha/controles.jsx
// (ATUALIZADO: Oculta o seletor de Afinidade se NEX < 50%)

import React from 'react';

// Agora recebemos a nova prop: canChangeTheme
function Controles({ 
  temaAtual, 
  onSave, 
  onClear, 
  onExport, 
  onImport, 
  onThemeChange,
  canChangeTheme // <--- Prop recebida
}) {

  // Handler local para o <input type="file">
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImport(file);
      e.target.value = null; 
    }
  };

  return (
    <section className="box box-controles" id="grid-controles">
      
      <button id="btn-salvar" onClick={onSave}>
        Salvar
      </button>
      <button id="btn-limpar" onClick={onClear}>
        Limpar
      </button>
      <button id="btn-exportar" onClick={onExport}>
        Exportar (JSON)
      </button>
      
      <label htmlFor="input-importar" className="btn-importar-label">
        Importar
      </label>
      <input 
        type="file" 
        id="input-importar" 
        accept=".json" 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />

      {/* LÓGICA DE OCULTAÇÃO: Só renderiza se canChangeTheme for true */}
      {canChangeTheme ? (
        <div className="seletor-tema">
          <label htmlFor="tema-elemento">Afinidade:</label>
          <select 
            id="tema-elemento"
            value={temaAtual}
            onChange={(e) => onThemeChange(e.target.value)}
          >
            <option value="tema-ordem">Sem Afinidade</option>
            <option value="tema-sangue">Sangue</option>
            <option value="tema-morte">Morte</option>
            <option value="tema-conhecimento">Conhecimento</option>
            <option value="tema-energia">Energia</option>
          </select>
        </div>
      ) : (
        // Opcional: Pode mostrar uma mensagem ou apenas nada
        <div className="seletor-tema" style={{opacity: 0.5, pointerEvents: 'none', display: 'none'}}>
            {/* Seletor oculto/desativado para NEX < 50% */}
             <label>Afinidade: (NEX 50%+)</label>
        </div>
      )}
      
    </section>
  );
}

export default Controles;