// assets/js/modules/parametrizacao.js
import { db } from '../app.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function render() {
    return `
    <div class="portal-container" style="display: flex; min-height: 100vh; background-color: #f4f6f9;">
        <!-- Menu Lateral -->
        <aside class="sidebar" style="width: 260px; background-color: #1a233a; color: #fff; padding: 20px;">
            <div class="logo-section" style="display: flex; align-items: center; margin-bottom: 30px;">
                <div style="background-color: #3b82f6; padding: 8px; border-radius: 8px; margin-right: 10px;">🏢</div>
                <div>
                    <h3 style="margin: 0; font-size: 16px;">Portal RH</h3>
                    <small style="color: #8a99ad;">Gestão de Vencimentos</small>
                </div>
            </div>
            <nav class="menu">
                <p style="color: #4f5d73; font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 10px;">Principal</p>
                <a href="#dashboard" style="display: block; color: #8a99ad; padding: 10px; text-decoration: none; margin-bottom: 10px;">📊 Dashboard</a>
                
                <p style="color: #4f5d73; font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 10px;">Configurações</p>
                <a href="#parametrizacao" style="display: block; color: #fff; background-color: #3b82f6; padding: 10px; border-radius: 6px; text-decoration: none; margin-bottom: 10px;">⚙️ Parametrização</a>
            </nav>
        </aside>

        <!-- Conteúdo Principal -->
        <main class="main-content" style="flex: 1; padding: 30px;">
            <header style="margin-bottom: 30px;">
                <h2 style="margin: 0; font-size: 24px; color: #1a233a;">Parametrização do Sistema</h2>
                <p style="color: #64748b; margin: 5px 0 0 0;">Configure os dados base da empresa e o calendário de feriados.</p>
            </header>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                
                <!-- Bloco 1: Dados da Empresa -->
                <div style="background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <h4 style="margin: 0 0 20px 0; color: #1a233a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">🏢 Dados da Empresa</h4>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Nome da Empresa</label>
                        <input type="text" id="empresa-nome" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Morada da Empresa</label>
                        <input type="text" id="empresa-morada" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">NIF da Empresa</label>
                        <input type="text" id="empresa-nif" maxlength="9" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                </div>

                <!-- Bloco 2: Calendário e Feriados -->
                <div style="background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <h4 style="margin: 0 0 20px 0; color: #1a233a; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">📅 Calendário e Dias Santos</h4>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Ano Corrente do Calendário</label>
                        <input type="number" id="cal-ano" value="2026" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Feriados Nacionais e Dias Santos (Separados por vírgula)</label>
                        <textarea id="cal-feriados-nacionais" rows="2" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-family:inherit;" placeholder="Ex: 01/01, 25/04, 01/05, 10/06, 25/12"></textarea>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Feriados Locais (Município)</label>
                        <input type="text" id="cal-feriados-locais" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="Ex: 24/06 (São João)">
                    </div>
                </div>
            </div>

            <!-- Botão de Gravar -->
            <div style="margin-top: 20px; text-align: right;">
                <button id="btn-salvar-param" style="background-color: #10b981; color: #fff; border: none; padding: 12px 30px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">💾 Guardar Configurações</button>
            </div>
        </main>
    </div>
    `;
}

export async function init() {
    const docRef = doc(db, "configuracoes", "empresa_base");

    // 1. Carregar dados guardados do Firebase (se existirem)
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const dados = docSnap.data();
            document.getElementById('empresa-nome').value = dados.nome || '';
            document.getElementById('empresa-morada').value = dados.morada || '';
            document.getElementById('empresa-nif').value = dados.nif || '';
            document.getElementById('cal-ano').value = dados.ano || '2026';
            document.getElementById('cal-feriados-nacionais').value = dados.feriadosNacionais || '';
            document.getElementById('cal-feriados-locais').value = dados.feriadosLocais || '';
        }
    } catch (error) {
        console.error("Erro ao carregar parametrização:", error);
    }

    // 2. Evento para Salvar dados no Firebase
    document.getElementById('btn-salvar-param').addEventListener('click', async () => {
        const btn = document.getElementById('btn-salvar-param');
        btn.innerText = "A guardar...";
        btn.disabled = true;

        const dadosParaSalvar = {
            nome: document.getElementById('empresa-nome').value,
            morada: document.getElementById('empresa-morada').value,
            nif: document.getElementById('empresa-nif').value,
            ano: document.getElementById('cal-ano').value,
            feriadosNacionais: document.getElementById('cal-feriados-nacionais').value,
            feriadosLocais: document.getElementById('cal-feriados-locais').value
        };

        try {
            await setDoc(docRef, dadosParaSalvar);
            alert("Parâmetros guardados com sucesso no Firebase!");
        } catch (error) {
            alert("Erro ao salvar: " + error.message);
        } finally {
            btn.innerText = "💾 Guardar Configurações";
            btn.disabled = false;
        }
    });
}