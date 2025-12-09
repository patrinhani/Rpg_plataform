// src/components/BackgroundDinamico.jsx
import React, { useState, useEffect } from 'react';
import '../styles/style.css'; // Importa estilos para pegar as variáveis de tema

export default function BackgroundDinamico() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // --- 1. LÓGICA PARA COMPUTADOR (Mouse) ---
    const handleMouseMove = (e) => {
      // Divide por um número maior para o movimento ser sutil e elegante
      const x = (window.innerWidth - e.pageX * 2) / 35;
      const y = (window.innerHeight - e.pageY * 2) / 35;
      setOffset({ x, y });
    };

    // --- 2. LÓGICA PARA CELULAR (Giroscópio/Acelerômetro) ---
    const handleOrientation = (e) => {
      // e.gamma = Inclinação Esquerda/Direita (-90 a 90)
      // e.beta  = Inclinação Frente/Trás (-180 a 180)
      
      let x = e.gamma; 
      let y = e.beta;  

      // Limitadores para o fundo não "fugir" da tela se girar demais
      if (x > 40) x = 40;
      if (x < -40) x = -40;
      if (y > 90) y = 90;
      if (y < -90) y = -90;

      // Sensibilidade no mobile
      const mobileSensibilidade = 1.2; 
      
      // Ajuste de "Ponto Zero": Consideramos 45 graus como a posição natural de segurar o celular
      setOffset({ 
        x: x * mobileSensibilidade, 
        y: (y - 45) * mobileSensibilidade 
      });
    };

    // Adiciona os ouvintes de evento
    window.addEventListener('mousemove', handleMouseMove);
    
    // Verifica se o navegador suporta orientação de dispositivo
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    // Limpeza ao desmontar
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  return (
    <div 
        id="parallax-background" 
        style={{ 
            // Aplica o movimento calculado
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            // Otimizações de performance para mobile
            willChange: 'transform',
            transition: 'transform 0.1s linear' 
        }}
    >
        {/* Carrega todos os símbolos; o CSS do tema decide qual aparece (opacity) */}
        <img id="simbolo-ordem" className="simbolo-parallax" src="/assets/images/SimboloSemafinidade.webp" alt="" />
        <img id="simbolo-sangue" className="simbolo-parallax" src="/assets/images/SimboloSangue.webp" alt="" />
        <img id="simbolo-morte" className="simbolo-parallax" src="/assets/images/SimboloMorte.webp" alt="" />
        <img id="simbolo-conhecimento" className="simbolo-parallax" src="/assets/images/SimboloConhecimento.webp" alt="" />
        <img id="simbolo-energia" className="simbolo-parallax" src="/assets/images/SimboloEnergia.webp" alt="" />
    </div>
  );
}