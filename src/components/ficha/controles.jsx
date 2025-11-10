// /src/components/ficha/controles.jsx

import React from 'react';

// Recebemos o tema atual e todas as funções de 'clique' como props
function Controles({ 
  temaAtual, 
  onSave, 
  onClear, 
  onExport, 
  onImport, 
  onThemeChange 
}) {

  // Handler local para o <input type="file">
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImport(file);
      // Limpa o input para permitir importar o mesmo arquivo de novo
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
      
      {/* O <label> agora usa a classe CSS que adicionamos no style.css */}
      <label htmlFor="input-importar" className="btn-importar-label">
        Importar
      </label>
      <input 
        type="file" 
        id="input-importar" 
        accept=".json" 
        style={{ display: 'none' }} // O input real fica escondido
        onChange={handleFileChange} 
      />

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
    </section>
  );
}

export default Controles;