// /src/components/AnimacaoSangue.jsx
// (VERSÃO CORRIGIDA - Caminho da textura do símbolo corrigido para .webp)

import React, { useEffect, useRef, memo } from 'react';
import * as THREE from 'three';

const AnimacaoSangue = memo(({ isVisible, onComplete }) => {
    
    const mountRef = useRef(null);
    const stateRef = useRef({
        scene: null,
        camera: null,
        renderer: null,
        clock: null,
        allCuts: [],
        symbolMaterial: null, 
        timeToNextCut: 0.4,
        cutInterval: 0.4,
        animationFrameId: null,
    });
    
    // Shaders (Não mudam)
    const vertexShader = `
        varying vec2 vUv;
        uniform float u_age;
        uniform float u_seed;
        vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }
        vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        float cnoise(vec2 P) {
            vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
            vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
            Pi = mod(Pi, 289.0);
            vec4 ix = Pi.xzxz;
            vec4 iy = Pi.yyww;
            vec4 fx = Pf.xzxz;
            vec4 fy = Pf.yyww;
            vec4 i = permute(permute(ix) + iy);
            vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
            vec4 gy = abs(gx) - 0.5 ;
            vec4 tx = floor(gx + 0.5);
            gx = gx - tx;
            vec2 g00 = vec2(gx.x,gy.x);
            vec2 g10 = vec2(gx.y,gy.y);
            vec2 g01 = vec2(gx.z,gy.z);
            vec2 g11 = vec2(gx.w,gy.w);
            vec4 n = 1.79284291400159 - 0.85373472095314 * vec4( dot(g00, g00), dot(g10, g10), dot(g01, g01), dot(g11, g11) );
            g00 = g00 * n.x;
            g10 = g10 * n.y;
            g01 = g01 * n.z;
            g11 = g11 * n.w;
            float n00 = dot(g00, vec2(fx.x, fy.x));
            float n10 = dot(g10, vec2(fx.y, fy.y));
            float n01 = dot(g01, vec2(fx.z, fy.z));
            float n11 = dot(g11, vec2(fx.w, fy.w));
            vec2 fade_xy = fade(Pf.xy);
            vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
            float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
            return 2.3 * n_xy;
        }
        void main() {
            vUv = uv;
            vec3 pos = position;
            float flash = sin(u_age * 3.14159);
            float displace_strength = 0.3 * flash;
            float noise = cnoise(vec2(uv.x * 20.0 + u_seed, u_seed));
            pos.y += noise * displace_strength * (position.y * 2.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `;
    const fragmentShader = `
        varying vec2 vUv;
        uniform float u_time;
        uniform float u_age;
        uniform float u_seed;
        uniform float u_bloodiness;
        uniform float u_direction;
        vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }
        vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        float cnoise(vec2 P) {
            vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
            vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
            Pi = mod(Pi, 289.0);
            vec4 ix = Pi.xzxz;
            vec4 iy = Pi.yyww;
            vec4 fx = Pf.xzxz;
            vec4 fy = Pf.yyww;
            vec4 i = permute(permute(ix) + iy);
            vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
            vec4 gy = abs(gx) - 0.5 ;
            vec4 tx = floor(gx + 0.5);
            gx = gx - tx;
            vec2 g00 = vec2(gx.x,gy.x);
            vec2 g10 = vec2(gx.y,gy.y);
            vec2 g01 = vec2(gx.z,gy.z);
            vec2 g11 = vec2(gx.w,gy.w);
            vec4 n = 1.79284291400159 - 0.85373472095314 * vec4( dot(g00, g00), dot(g10, g10), dot(g01, g01), dot(g11, g11) );
            g00 = g00 * n.x;
            g10 = g10 * n.y;
            g01 = g01 * n.z;
            g11 = g11 * n.w;
            float n00 = dot(g00, vec2(fx.x, fy.x));
            float n10 = dot(g10, vec2(fx.y, fy.y));
            float n01 = dot(g01, vec2(fx.z, fy.z));
            float n11 = dot(g11, vec2(fx.w, fy.w));
            vec2 fade_xy = fade(Pf.xy);
            vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
            float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
            return 2.3 * n_xy;
        }
        void main() {
            float flash = sin(u_age * 3.14159);
            float noise = cnoise(vec2(vUv.x * 15.0, vUv.y * 5.0) + u_seed);
            float distortion = noise * 0.1;
            float dist = abs(vUv.y - 0.5 + distortion);
            float cut_edge = 0.04;
            float cut = 1.0 - smoothstep(0.0, cut_edge, dist);
            float blood_thickness = cut_edge + (0.08 * u_bloodiness);
            float blood = 1.0 - smoothstep(cut_edge, blood_thickness, dist);
            float splatter_noise = cnoise(vUv * 25.0 + u_seed * 0.5);
            float splatter = smoothstep(0.6, 0.7, splatter_noise);
            splatter *= (1.0 - smoothstep(blood_thickness, blood_thickness + 0.3, dist));
            vec3 cutColor = vec3(0.0);
            vec3 bloodColor = vec3(0.7, 0.0, 0.0);
            vec3 finalColor = bloodColor * max(blood, splatter);
            finalColor = mix(finalColor, cutColor, cut);
            float taper = 1.0 - smoothstep(0.6, 1.0, abs(vUv.x - 0.5) * 2.0);
            float reveal_duration = 0.2;
            float reveal_progress = smoothstep(0.0, reveal_duration, u_age);
            float draw_coord = (u_direction < 0.5) ? vUv.x : 1.0 - vUv.x;
            float reveal_mask = smoothstep(0.0, 0.1, reveal_progress - draw_coord);
            float total_alpha = max(cut, max(blood, splatter));
            float finalAlpha = total_alpha * flash * taper * reveal_mask;
            gl_FragColor = vec4(finalColor, finalAlpha);
        }
    `;
    
    useEffect(() => {
        const state = stateRef.current;
        const mount = mountRef.current;
        
        const minInterval = 0.005;
        const accelerationFactor = 0.82; 

        function init() {
            state.clock = new THREE.Clock();
            state.scene = new THREE.Scene();

            const aspect = window.innerWidth / window.innerHeight;
            const frustumSize = 10;
            state.camera = new THREE.OrthographicCamera(
                frustumSize * aspect / -2, frustumSize * aspect / 2,
                frustumSize / 2, frustumSize / -2,
                0.1, 100
            );
            state.camera.position.z = 10;

            state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            state.renderer.setSize(window.innerWidth, window.innerHeight);
            if (mount.firstChild) {
                mount.removeChild(mount.firstChild);
            }
            mount.appendChild(state.renderer.domElement);

            const textureLoader = new THREE.TextureLoader();
            
            // --- INÍCIO DA CORREÇÃO ---
            // O caminho foi corrigido de .png para .webp
            textureLoader.load(
                '/assets/images/SimboloSangue.webp', 
            // --- FIM DA CORREÇÃO ---
                (texture) => {
                    const symbolAspect = texture.image.width / texture.image.height;
                    const symbolHeight = 5;
                    const symbolWidth = symbolHeight * symbolAspect;
                    const symbolGeo = new THREE.PlaneGeometry(symbolWidth, symbolHeight);
                    
                    const symbolMat = new THREE.MeshBasicMaterial({ 
                        map: texture, 
                        transparent: true,
                        color: 0xffffff, // Multiplica a textura por branco (mantém a cor original)
                        opacity: 0.0 
                    });
                    
                    state.symbolMaterial = symbolMat; 
                    
                    const symbolMesh = new THREE.Mesh(symbolGeo, symbolMat);
                    symbolMesh.position.z = 0;
                    state.scene.add(symbolMesh);
                },
                undefined,
                (err) => {
                    // Se falhar (mesmo com o .webp), ele mostrará um quadrado vermelho
                    // que foi o que provavelmente aconteceu antes.
                    console.error('Erro ao carregar a textura do símbolo:', err); 
                    const symbolGeo = new THREE.PlaneGeometry(3, 3);
                    const symbolMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Fallback
                    const symbolMesh = new THREE.Mesh(symbolGeo, symbolMat);
                    symbolMesh.position.z = 0;
                    state.scene.add(symbolMesh);
                }
            );
            
            window.addEventListener('resize', onWindowResize);
            animate();
        }

        function onWindowResize() {
            if (!state.camera || !state.renderer) return;
            const aspect = window.innerWidth / window.innerHeight;
            const frustumSize = 10;
            state.camera.left = frustumSize * aspect / -2;
            state.camera.right = frustumSize * aspect / 2;
            state.camera.top = frustumSize / 2;
            state.camera.bottom = frustumSize / -2;
            state.camera.updateProjectionMatrix();
            state.renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function createClawCut() {
            if (!state.scene) return;
            
            const aspect = window.innerWidth / window.innerHeight;
            const frustumSize = 10;
            const group = new THREE.Group();

            group.position.set(
                (Math.random() - 0.5) * frustumSize * aspect * 1.5,
                (Math.random() - 0.5) * frustumSize * 1.5,
                0
            );
            group.rotation.z = Math.random() * Math.PI * 2;

            const isKnife = Math.random() < 0.3; 
            const bloodiness = 0.5 + Math.random(); 
            const direction = Math.random(); 

            if (isKnife) {
                // Faca (1 corte)
                const cutLength = 6.0 + Math.random() * 10.0;
                const cutWidth = 0.3 + Math.random() * 0.7;
                const geometry = new THREE.PlaneGeometry(cutLength, cutWidth, 20, 1); 
                const material = new THREE.ShaderMaterial({
                    uniforms: {
                        u_time: { value: 0.0 }, u_age: { value: 0.0 },
                        u_seed: { value: Math.random() * 100.0 },
                        u_bloodiness: { value: bloodiness }, u_direction: { value: direction }
                    },
                    vertexShader, fragmentShader,
                    transparent: true, side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.z = (Math.random() < 0.3) ? 1 : -1;
                group.add(mesh);
                state.allCuts.push({ mesh, material }); 
            } else {
                // Garra (3-5 cortes)
                const numClaws = 3 + Math.floor(Math.random() * 3);
                const baseCutLength = 5.0 + Math.random() * 9.0;
                const baseCutWidth = 0.25 + Math.random() * 0.6;
                const baseSpacing = 0.4 + Math.random() * 1.2;
                const baseRotation = (Math.random() - 0.5) * 0.8; 
                const baseYOffset = (Math.random() - 0.5) * 1.0;
                const zPos = (Math.random() < 0.3) ? 1 : -1;

                for (let i = 0; i < numClaws; i++) {
                    const cutLength = baseCutLength * (1.0 + (Math.random() - 0.5) * 1.2); 
                    const cutWidth = baseCutWidth * (1.0 + (Math.random() - 0.5) * 1.2);
                    const geometry = new THREE.PlaneGeometry(cutLength, cutWidth, 20, 1);
                    const material = new THREE.ShaderMaterial({
                        uniforms: {
                            u_time: { value: 0.0 }, u_age: { value: 0.0 },
                            u_seed: { value: Math.random() * 100.0 },
                            u_bloodiness: { value: bloodiness }, u_direction: { value: direction }
                        },
                        vertexShader, fragmentShader,
                        transparent: true, side: THREE.DoubleSide
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.x = (i - (numClaws - 1) * 0.5) * (baseSpacing * (1.0 + (Math.random() - 0.5) * 1.0));
                    mesh.position.y = baseYOffset + (Math.random() - 0.5) * 1.0;
                    mesh.rotation.z = baseRotation + (Math.random() - 0.5) * 0.6;
                    mesh.position.z = zPos; 
                    group.add(mesh);
                    state.allCuts.push({ mesh, material });
                }
            }
            state.scene.add(group); 
        }

        function animate() {
            if (!stateRef.current.renderer) {
                return;
            }

            state.animationFrameId = requestAnimationFrame(animate);
            
            const delta = state.clock.getDelta();
            const elapsedTime = state.clock.getElapsedTime();

            state.timeToNextCut -= delta;
            if (state.timeToNextCut <= 0) {
                let cutsToMake = (Math.random() > 0.5) ? 2 : 1; 
                for (let i = 0; i < cutsToMake; i++) {
                    createClawCut();
                }
                state.cutInterval = Math.max(minInterval, state.cutInterval * accelerationFactor);
                state.timeToNextCut = state.cutInterval;
            }

            const cutLifeSpan = 1.5; 

            for (let i = state.allCuts.length - 1; i >= 0; i--) {
                const cut = state.allCuts[i];
                cut.material.uniforms.u_time.value = elapsedTime;
                cut.material.uniforms.u_age.value += delta * cutLifeSpan; 

                if (cut.material.uniforms.u_age.value > 1.0) {
                    if(cut.mesh.parent) {
                        state.scene.remove(cut.mesh.parent); 
                    }
                    cut.mesh.geometry.dispose();
                    cut.material.dispose();
                    state.allCuts.splice(i, 1);
                }
            }

            if (state.symbolMaterial) {
                const fadeInStart = 1.5; 
                const fadeInDuration = 1.5; 
                
                const progress = (elapsedTime - fadeInStart) / fadeInDuration;
                const opacity = Math.max(0.0, Math.min(1.0, progress));
                
                state.symbolMaterial.opacity = opacity * 0.8; 
            }
            
            state.renderer.render(state.scene, state.camera);
        }
        
        let timeoutId;
        
        if (isVisible) {
            init();
            
            timeoutId = setTimeout(() => {
                onComplete(); 
            }, 4000); // 4 segundos
        }

        // Função de Limpeza (Cleanup)
        return () => {
            if (state.animationFrameId) {
                cancelAnimationFrame(state.animationFrameId);
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            window.removeEventListener('resize', onWindowResize);
            
            if (state.scene) {
                state.allCuts.forEach(cut => {
                     if(cut.mesh.parent) {
                        state.scene.remove(cut.mesh.parent); 
                    }
                    if(cut.mesh.geometry) cut.mesh.geometry.dispose();
                    if(cut.material) cut.material.dispose();
                });
                state.scene.children.forEach(child => {
                    if(child instanceof THREE.Group) {
                         child.children.forEach(mesh => {
                            if (mesh.geometry) mesh.geometry.dispose();
                            if (mesh.material) mesh.material.dispose();
                         });
                    }
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                    if (child.texture) child.texture.dispose();
                });
                state.scene.clear();
            }

            if (state.renderer) {
                state.renderer.dispose();
            }
            
            if (mount) {
                mount.innerHTML = "";
            }

            stateRef.current = {
                scene: null, camera: null, renderer: null, clock: null,
                allCuts: [], symbolMaterial: null,
                timeToNextCut: 0.4, cutInterval: 0.4,
                animationFrameId: null,
            };
        };
        
    }, [isVisible, onComplete, fragmentShader, vertexShader]);

    return <div id="three-transition-overlay" ref={mountRef} />;
});

export default AnimacaoSangue;