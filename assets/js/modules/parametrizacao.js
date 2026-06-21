// assets/js/modules/parametrizacao.js
import { getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { docEmpresa, empresaAtivaId, editarEmpresa, empresaAtiva } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';

export function render() {
    return `
    <div style="display: flex; min-height: 100vh; background-color: var(--rh-bg); font-family: sans-serif;">
        ${renderSidebarHTML('parametrizacao')}

        <main class="main-content" style="flex: 1; padding: 30px;">
            <header style="margin-bottom: 30px;">
                <h2 style="margin: 0; font-size: 24px; color: var(--rh-primary);">Parametrização do Sistema</h2>
                <p style="color: var(--rh-text-muted); margin: 5px 0 0 0;">Configure os dados base da empresa e o calendário de feriados.</p>
            </header>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div style="background: var(--rh-bg-card); padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <h4 style="margin: 0 0 20px 0; color: var(--rh-primary); border-bottom: 2px solid var(--rh-primary); padding-bottom: 8px;">🏢 Dados da Empresa</h4>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted);">Nome da Empresa</label>
                        <input type="text" id="empresa-nome" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted);">Morada da Empresa</label>
                        <input type="text" id="empresa-morada" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted);">NIF da Empresa</label>
                        <input type="text" id="empresa-nif" maxlength="9" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing: border-box;">
                    </div>
                </div>

                <div style="background: var(--rh-bg-card); padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column;">
                    <h4 style="margin: 0 0 20px 0; color: var(--rh-primary); border-bottom: 2px solid var(--rh-warning); padding-bottom: 8px;">📅 Calendário e Dias Santos</h4>
                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted);">Ano Corrente do Calendário</label>
                        <input type="number" id="cal-ano" value="2026" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing: border-box;">
                    </div>
                    <label style="display:block; margin-bottom:10px; font-weight:500; color:var(--rh-text-muted);">Feriados (Selecionar quais são obrigatórios):</label>
                    <div id="lista-feriados-linhas" style="max-height: 320px; overflow-y: auto; border: 1px solid var(--rh-border); border-radius: 8px; padding: 12px; background-color: var(--rh-bg-muted); margin-bottom: 15px;"></div>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted);">Feriados Locais (Município)</label>
                        <input type="text" id="cal-feriados-locais" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing: border-box;" placeholder="Ex: 24/06 (São João)">
                    </div>
                    <div style="margin-top: auto;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted);">🏖️ Limite Anual de Dias de Férias</label>
                        <input type="number" id="cal-limite-ferias" min="1" max="60" value="22" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing: border-box;">
                        <small style="color:var(--rh-text-subtle); font-size:12px;">Número máximo de dias de férias por funcionário por ano (legal mínimo: 22).</small>
                    </div>
                    <div style="margin-top: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted);">🍽️ Valor do Subsídio de Refeição (€/dia)</label>
                        <input type="number" id="subsidio-refeicao" min="0" step="0.01" value="6.00" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing: border-box;">
                        <small style="color:var(--rh-text-subtle); font-size:12px;">Valor diário pago por cada dia de trabalho efectivo com direito a subsídio de refeição.</small>
                    </div>
                    <div style="margin-top: 15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted);">⏱️ Mínimo de Horas/Dia para Subsídio de Refeição</label>
                        <input type="number" id="horas-min-subsidio" min="0" max="24" step="0.5" value="4" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing: border-box;">
                        <small style="color:var(--rh-text-subtle); font-size:12px;">Em dias com falta parcial justificada, o colaborador só mantém direito ao subsídio se as horas efetivamente trabalhadas nesse dia atingirem este mínimo.</small>
                    </div>
                </div>

                <div style="background: var(--rh-bg-card); padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); grid-column: 1 / -1;">
                    <h4 style="margin: 0 0 20px 0; color: var(--rh-primary); border-bottom: 2px solid var(--rh-danger); padding-bottom: 8px;">💶 Processamento de Vencimentos</h4>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
                        <div>
                            <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted);">Taxa de Segurança Social — Trabalhador (%)</label>
                            <input type="number" id="taxa-ss-trabalhador" min="0" max="100" step="0.01" value="11" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing: border-box;">
                            <small style="color:var(--rh-text-subtle); font-size:12px;">Taxa legal padrão em Portugal: 11%. Ajustável para regimes especiais.</small>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted);">Taxa de Segurança Social — Entidade Patronal (%)</label>
                            <input type="number" id="taxa-ss-entidade" min="0" max="100" step="0.01" value="23.75" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing: border-box;">
                            <small style="color:var(--rh-text-subtle); font-size:12px;">Taxa legal padrão: 23,75%. Apenas informativa nos recibos (custo da empresa).</small>
                        </div>
                    </div>
                    <p style="margin:14px 0 0;font-size:12px;color:var(--rh-text-subtle);background:var(--rh-warning-bg);border:1px solid var(--rh-warning);border-radius:6px;padding:10px 12px;">
                        ⚠️ A retenção de IRS <strong>não</strong> é calculada automaticamente — defina a taxa de cada colaborador na sua ficha individual, conforme a tabela de retenção em vigor.
                    </p>
                </div>
            </div>

            <div style="margin-top: 20px; text-align: right;">
                <button id="btn-salvar-param" style="background-color: var(--rh-accent); color: var(--rh-text); border: none; padding: 12px 30px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">💾 Guardar Configurações</button>
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
            <div style="display: flex; align-items: center; padding: 8px 12px; margin-bottom: 6px; background: var(--rh-bg-card); border: 1px solid var(--rh-border); border-radius: 6px; font-size: 13px;">
                <input type="checkbox" class="check-feriado" data-nome="${f.nome}" ${isChecked ? 'checked' : ''} style="margin-right: 12px; transform: scale(1.2);">
                <span style="font-weight: bold; color: var(--rh-primary); background-color: var(--rh-primary-soft); padding: 2px 8px; border-radius: 4px; font-family: monospace; min-width: 45px;">${f.data}</span>
                <span style="font-weight: 500; color: var(--rh-primary-dark); flex: 1; margin-left: 15px;">${f.nome}</span>
            </div>
        `;
    });
}

export async function init() {
    await initSidebar();

    const docRef = docEmpresa("configuracoes", "empresa_base");
    const inputAno = document.getElementById('cal-ano');
    let anoAtual = parseInt(inputAno.value) || 2026;
    let feriadosAtivosGuardados = [];

    // Dados de identificação da empresa vêm da própria entidade "empresa"
    // (criada/editada também em "empresas.js"), não de "configuracoes".
    try {
        const emp = await empresaAtiva();
        if (emp) {
            document.getElementById('empresa-nome').value = emp.nome || '';
            document.getElementById('empresa-morada').value = emp.morada || '';
            document.getElementById('empresa-nif').value = emp.nif || '';
        }
    } catch (error) { console.error('Erro ao carregar dados da empresa:', error); }

    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const dados = docSnap.data();
            document.getElementById('cal-feriados-locais').value = dados.feriadosLocais || '';
            if (dados.ano) inputAno.value = dados.ano;
            if (dados.limiteDiasFerias) document.getElementById('cal-limite-ferias').value = dados.limiteDiasFerias;
            if (dados.subsidioRefeicao !== undefined) document.getElementById('subsidio-refeicao').value = dados.subsidioRefeicao;
            if (dados.horasMinSubsidio !== undefined) document.getElementById('horas-min-subsidio').value = dados.horasMinSubsidio;
            if (dados.taxaSSTrabalhador !== undefined) document.getElementById('taxa-ss-trabalhador').value = dados.taxaSSTrabalhador;
            if (dados.taxaSSEntidade !== undefined) document.getElementById('taxa-ss-entidade').value = dados.taxaSSEntidade;
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
            await editarEmpresa(empresaAtivaId(), {
                nome: document.getElementById('empresa-nome').value,
                morada: document.getElementById('empresa-morada').value,
                nif: document.getElementById('empresa-nif').value,
            });
            await setDoc(docRef, {
                ano: inputAno.value,
                feriadosLocais: document.getElementById('cal-feriados-locais').value,
                feriadosAtivos: selecionados,
                limiteDiasFerias: parseInt(document.getElementById('cal-limite-ferias').value) || 22,
                subsidioRefeicao: parseFloat(document.getElementById('subsidio-refeicao').value) || 0,
                horasMinSubsidio: parseFloat(document.getElementById('horas-min-subsidio').value) || 0,
                taxaSSTrabalhador: parseFloat(document.getElementById('taxa-ss-trabalhador').value) || 11,
                taxaSSEntidade: parseFloat(document.getElementById('taxa-ss-entidade').value) || 23.75
            });
            alert("Parâmetros atualizados com sucesso!");
        } catch (error) { alert("Erro ao salvar: " + error.message); }
        finally { btn.innerText = "💾 Guardar Configurações"; btn.disabled = false; }
    });
}
