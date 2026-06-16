// assets/js/modules/parametrizacao.js
import { db } from '../app.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function render() {
    return `
    <div class="portal-container" style="display: flex; min-height: 100vh; background-color: #f4f6f9; font-family: sans-serif;">
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
                <button onclick="window.router.navigate('parametrizacao')" style="display: block; width: 100%; text-align: left; background-color: #3b82f6; color: #fff; padding: 10px; border: none; border-radius: 6px; cursor: pointer; margin-bottom: 10px; font-size: 14px; font-weight: bold;">⚙️ Parametrização</button>
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
                        <input type="text" id="empresa-nome" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Morada da Empresa</label>
                        <input type="text" id="empresa-morada" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">NIF da Empresa</label>
                        <input type="text" id="empresa-nif" maxlength="9" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing: border-box;">
                    </div>
                </div>

                <div style="background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column;">
                    <h4 style="margin: 0 0 20px 0; color: #1a233a; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">📅 Calendário e Dias Santos</h4>
                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Ano Corrente do Calendário</label>
                        <input type="number" id="cal-ano" value="2026" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing: border-box;">
                    </div>
                    <label style="display:block; margin-bottom:10px; font-weight:500; color:#475569;">Feriados (Selecionar quais são obrigatórios):</label>
                    <div id="lista-feriados-linhas" style="max-height: 320px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background-color: #f8fafc; margin-bottom: 15px;"></div>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">Feriados Locais (Município)</label>
                        <input type="text" id="cal-feriados-locais" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing: border-box;" placeholder="Ex: 24/06 (São João)">
                    </div>
                    <div style="margin-top: auto;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:#475569;">🏖️ Limite Anual de Dias de Férias</label>
                        <input type="number" id="cal-limite-ferias" min="1" max="60" value="22" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing: border-box;">
                        <small style="color:#94a3b8; font-size:12px;">Número máximo de dias de férias por funcionário por ano (legal mínimo: 22).</small>
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

function calcularFeriadosPortugal(ano) {
    const a = ano % 19; const b = Math.floor(ano / 100); const c = ano % 100;
    const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mesPascoa = Math.floor((h + l - 7 * m + 114) / 31);
    const diaPascoa = ((h + l - 7 * m + 114) % 31) + 1;
    const pascoa = new Date(ano, mesPascoa - 1, diaPascoa);
    
    const carnaval = new Date(pascoa); carnaval.setDate(pascoa.getDate() - 47);
    const sextaSanta = new Date(pascoa); sextaSanta.setDate(pascoa.getDate() - 2);
    const corpoDeDeus = new Date(pascoa); corpoDeDeus.setDate(pascoa.getDate() + 60);

    const fmt = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');

    return [
        { data: "01/01", nome: "Ano Novo" },
        { data: fmt(carnaval), nome: "Carnaval" },
        { data: fmt(sextaSanta), nome: "Sexta-feira Santa" },
        { data: fmt(pascoa), nome: "Páscoa" },
        { data: "25/04", nome: "Dia da Liberdade" },
        { data: "01/05", nome: "Dia do Trabalhador" },
        { data: fmt(corpoDeDeus), nome: "Corpo de Deus" },
        { data: "10/06", nome: "Dia de Portugal" },
        { data: "15/08", nome: "Assunção de N. Sra." },
        { data: "05/10", nome: "Implantação da República" },
        { data: "01/11", nome: "Todos os Santos" },
        { data: "01/12", nome: "Restauração da Independência" },
        { data: "08/12", nome: "Imaculada Conceição" },
        { data: "25/12", nome: "Natal" }
    ];
}

function atualizarInterfaceFeriados(lista, feriadosAtivos = []) {
    const container = document.getElementById('lista-feriados-linhas');
    if (!container) return;
    container.innerHTML = "";
    
    lista.forEach(f => {
        // Se a lista de guardados estiver vazia, assumimos tudo ligado (exceto Carnaval), 
        // ou podes definir a lógica padrão que preferires.
        const isChecked = feriadosAtivos.includes(f.nome) || (feriadosAtivos.length === 0 && f.nome !== "Carnaval");
        
        container.innerHTML += `
            <div style="display: flex; align-items: center; padding: 8px 12px; margin-bottom: 6px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px;">
                <input type="checkbox" class="check-feriado" data-nome="${f.nome}" ${isChecked ? 'checked' : ''} style="margin-right: 12px; transform: scale(1.2);">
                <span style="font-weight: bold; color: #3b82f6; background-color: #eff6ff; padding: 2px 8px; border-radius: 4px; font-family: monospace; min-width: 45px;">${f.data}</span>
                <span style="font-weight: 500; color: #1e293b; flex: 1; margin-left: 15px;">${f.nome}</span>
            </div>
        `;
    });
}

export async function init() {
    const docRef = doc(db, "configuracoes", "empresa_base");
    const inputAno = document.getElementById('cal-ano');
    let anoAtual = parseInt(inputAno.value) || 2026;
    let feriadosAtivosGuardados = [];

    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const dados = docSnap.data();
            document.getElementById('empresa-nome').value = dados.nome || '';
            document.getElementById('empresa-morada').value = dados.morada || '';
            document.getElementById('empresa-nif').value = dados.nif || '';
            document.getElementById('cal-feriados-locais').value = dados.feriadosLocais || '';
            if (dados.ano) inputAno.value = dados.ano;
            if (dados.limiteDiasFerias) document.getElementById('cal-limite-ferias').value = dados.limiteDiasFerias;
            feriadosAtivosGuardados = dados.feriadosAtivos || [];
        }
    } catch (error) { console.error("Erro ao carregar do Firebase:", error); }

    atualizarInterfaceFeriados(calcularFeriadosPortugal(anoAtual), feriadosAtivosGuardados);

    inputAno.addEventListener('change', () => {
        atualizarInterfaceFeriados(calcularFeriadosPortugal(parseInt(inputAno.value)), feriadosAtivosGuardados);
    });

    document.getElementById('btn-salvar-param').addEventListener('click', async () => {
        const btn = document.getElementById('btn-salvar-param');
        btn.innerText = "A guardar...";
        btn.disabled = true;

        const selecionados = Array.from(document.querySelectorAll('.check-feriado:checked'))
                                  .map(el => el.getAttribute('data-nome'));

        try {
            await setDoc(docRef, {
                nome: document.getElementById('empresa-nome').value,
                morada: document.getElementById('empresa-morada').value,
                nif: document.getElementById('empresa-nif').value,
                ano: inputAno.value,
                feriadosLocais: document.getElementById('cal-feriados-locais').value,
                feriadosAtivos: selecionados,
                limiteDiasFerias: parseInt(document.getElementById('cal-limite-ferias').value) || 22
            });
            alert("Parâmetros atualizados com sucesso!");
        } catch (error) { alert("Erro ao salvar: " + error.message); }
        finally { btn.innerText = "💾 Guardar Configurações"; btn.disabled = false; }
    });
}
