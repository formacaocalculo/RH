// assets/js/modules/parametrizacao.js
import { db } from '../app.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function render() {
    return `
    <div class="portal-container" style="display: flex; min-height: 100vh; background-color: #f4f6f9;">
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
                <button onclick="window.router.navigate('dashboard')" style="display: block; width: 100%; text-align: left; background: none; color: #8a99ad; padding: 10px; border: none; cursor: pointer; margin-bottom: 10px; font-size: 14px;">📊 Dashboard</button>
                
                <p style="color: #4f5d73; font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 10px;">Configurações</p>
                <button onclick="window.router.navigate('parametrizacao')" style="display: block; width: 100%; text-align: left; background-color: #3b82f6; color: #fff; padding: 10px; border: none; border-radius: 6px; cursor: pointer; margin-bottom: 10px; font-size: 14px;">⚙️ Parametrização</button>
            </nav>
        </aside>

        <main class="main-content" style="flex: 1; padding: 30px;">
            <header style="margin-bottom: 30px;">
                <h2 style="margin: 0; font-size: 24px; color: #1a233a;">Parametrização do Sistema</h2>
                <p style="color: #64748b; margin: 5px 0 0 0;">Configure os dados base da empresa e o calendário de feriados.</p>
            </header>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                
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

                <div style="background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <h4 style="margin: 0 0 20px 0; color: #1a233a; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">📅 Calendário e Dias Santos</h4>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Ano Corrente do Calendário</label>
                        <input type="number" id="cal-ano" value="2026" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Feriados Nacionais e Dias Santos (Separados por vírgula)</label>
                        <textarea id="cal-feriados-nacionais" rows="4" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-family:inherit;" placeholder="A calcular..."></textarea>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Feriados Locais (Município)</label>
                        <input type="text" id="cal-feriados-locais" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="Ex: 24/06 (São João)">
                    </div>
                </div>
            </div>

            <div style="margin-top: 20px; text-align: right;">
                <button id="btn-salvar-param" style="background-color: #10b981; color: #fff; border: none; padding: 12px 30px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">💾 Guardar Configurações</button>
            </div>
        </main>
    </div>
    `;
}

// --- FUNÇÃO PARA CALCULAR FERIADOS AUTOMATICAMENTE ---
function calcularFeriadosPortugal(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mesPascoa = Math.floor((h + l - 7 * m + 114) / 31);
    const diaPascoa = ((h + l - 7 * m + 114) % 31) + 1;

    const pascoa = new Date(ano, mesPascoa - 1, diaPascoa);
    
    const carnaval = new Date(pascoa);
    carnaval.setDate(pascoa.getDate() - 47);
    
    const sextaSanta = new Date(pascoa);
    sextaSanta.setDate(pascoa.getDate() - 2);
    
    const corpoDeDeus = new Date(pascoa);
    corpoDeDeus.setDate(pascoa.getDate() + 60);

    const fmt = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');

    const feriados = [
        `01/01 (Ano Novo)`,
        `${fmt(carnaval)} (Carnaval)`,
        `${fmt(sextaSanta)} (Sexta-feira Santa)`,
        `${fmt(pascoa)} (Páscoa)`,
        `25/04 (Dia da Liberdade)`,
        `01/05 (Dia do Trabalhador)`,
        `${fmt(corpoDeDeus)} (Corpo de Deus)`,
        `10/06 (Dia de Portugal)`,
        `15/08 (Assunção de N. Sra.)`,
        `05/10 (Implantação da República)`,
        `01/11 (Todos os Santos)`,
        `01/12 (Restauração da Independência)`,
        `08/12 (Imaculada Conceição)`,
        `25/12 (Natal)`
    ];

    return feriados.join(', ');
}

// --- APENAS UMA FUNÇÃO INIT ---
export async function init() {
    const docRef = doc(db, "configuracoes", "empresa_base");
    const inputAno = document.getElementById('cal-ano');
    const txtFeriados = document.getElementById('cal-feriados-nacionais');

    // 1. Tenta carregar do Firebase
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const dados = docSnap.data();
            document.getElementById('empresa-nome').value = dados.nome || '';
            document.getElementById('empresa-morada').value = dados.morada || '';
            document.getElementById('empresa-nif').value = dados.nif || '';
            inputAno.value = dados.ano || '2026';
            
            // Se já houver feriados gravados, usa esses. Se não, calcula automáticos
            txtFeriados.value = dados.feriadosNacionais || calcularFeriadosPortugal(parseInt(inputAno.value));
            document.getElementById('cal-feriados-locais').value = dados.feriadosLocais || '';
        } else {
            // Se for a primeira vez e o documento não existir, calcula na hora
            txtFeriados.value = calcularFeriadosPortugal(parseInt(inputAno.value));
        }
    } catch (error) {
        console.error("Erro ao carregar parametrização:", error);
        // Em caso de erro na rede, calcula localmente para não ficar em branco
        txtFeriados.value = calcularFeriadosPortugal(parseInt(inputAno.value));
    }

    // 2. Ouvinte para quando o utilizador alterar o ano na caixa de input
    inputAno.addEventListener('change', () => {
        const anoSelecionado = parseInt(inputAno.value) || 2026;
        txtFeriados.value = calcularFeriadosPortugal(anoSelecionado);
    });

    // 3. Evento para Salvar dados no Firebase
    document.getElementById('btn-salvar-param').addEventListener('click', async () => {
        const btn = document.getElementById('btn-salvar-param');
        btn.innerText = "A guardar...";
        btn.disabled = true;

        const dadosParaSalvar = {
            nome: document.getElementById('empresa-nome').value,
            morada: document.getElementById('empresa-morada').value,
            nif: document.getElementById('empresa-nif').value,
            ano: inputAno.value,
            feriadosNacionais: txtFeriados.value,
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