// assets/js/modules/criar-funcionario.js
import { addDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { renderHorarioTrabalho, lerHorarioTrabalhoDoForm, renderFilhosSection, inicializarFilhosState, obterFilhosState, renderSelectQualificacao, renderSelectEstadoCivil, validarNIB, validarNIF } from './colaborador-utils.js';
import { colEmpresa, docEmpresa } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';

export function render() {
    return `
    <div style="display: flex; min-height: 100vh; background-color: var(--rh-bg); font-family: sans-serif;">
        ${renderSidebarHTML('criar-funcionario')}

        <main class="main-content" style="flex: 1; padding: 30px; overflow-y: auto;">
            <header style="display: flex; align-items: center; gap: 15px; margin-bottom: 30px;">
                <button onclick="window.router.navigate('dashboard')" style="background: none; border: 1px solid var(--rh-border); padding: 8px 14px; border-radius: 6px; cursor: pointer; color: var(--rh-text-muted); font-size: 13px;">← Voltar</button>
                <div>
                    <h2 style="margin: 0; font-size: 24px; color: var(--rh-primary);">Novo Funcionário</h2>
                    <p style="color: var(--rh-text-muted); margin: 4px 0 0 0; font-size: 14px;">Preencha os dados e selecione os dias de férias.</p>
                </div>
            </header>

            <!-- Aviso NIB inline (só aparece ao submeter sem NIB) -->
            <div id="aviso-nib-form" style="display:none; background:var(--rh-warning-bg); border:1px solid var(--rh-warning); border-radius:8px; padding:14px 18px; margin-bottom:20px; color:var(--rh-warning-text); font-size:14px;">
                ⚠️ <strong>Atenção:</strong> O NIB não foi preenchido. O funcionário ficará sinalizado no dashboard até o NIB ser adicionado.
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">

                <!-- Dados Pessoais -->
                <div style="background: var(--rh-bg-card); padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
                    <h4 style="margin: 0 0 20px 0; color: var(--rh-primary); border-bottom: 2px solid var(--rh-primary); padding-bottom: 8px;">👤 Dados Pessoais</h4>

                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Nome Completo *</label>
                        <input type="text" id="func-nome" placeholder="Ex: Ana Silva" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">NIF *</label>
                        <input type="text" id="func-nif" maxlength="9" placeholder="9 dígitos" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                        <small id="nif-erro" style="color:var(--rh-danger); font-size:12px; display:none;">O NIF está errado. Verifique e introduza um NIF válido (9 dígitos, com dígito de controlo correto).</small>
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Data de Nascimento</label>
                        <input type="date" id="func-nascimento" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">💍 Estado Civil</label>
                        ${renderSelectEstadoCivil('func-estado-civil')}
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Morada</label>
                        <input type="text" id="func-morada" placeholder="Rua, número, localidade" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Código Postal</label>
                        <input type="text" id="func-codigo-postal" placeholder="0000-000 Localidade" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Nacionalidade</label>
                        <input type="text" id="func-nacionalidade" placeholder="ex.: Portuguesa" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Contacto Telefónico</label>
                        <input type="tel" id="func-contacto" maxlength="15" placeholder="9XX XXX XXX" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Email</label>
                        <input type="email" id="func-email" placeholder="colaborador@empresa.pt" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>

                    <hr style="border:none; border-top:1px solid var(--rh-border); margin: 18px 0;">

                    ${renderFilhosSection('novo')}
                </div>

                <!-- Dados Profissionais + NIB -->
                <div style="background: var(--rh-bg-card); padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
                    <h4 style="margin: 0 0 20px 0; color: var(--rh-primary); border-bottom: 2px solid var(--rh-secondary); padding-bottom: 8px;">💼 Dados Profissionais</h4>

                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Cargo / Função</label>
                        <input type="text" id="func-cargo" placeholder="Ex: Técnico de RH" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Departamento</label>
                        <input type="text" id="func-departamento" placeholder="Ex: Recursos Humanos" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Data de Admissão *</label>
                        <input type="date" id="func-admissao" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Tipo de Contrato</label>
                        <select id="func-tipo-contrato" onchange="window._funcToggleFim && window._funcToggleFim()" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px; background:var(--rh-bg-card);">
                            <option value="Sem termo">Sem termo</option>
                            <option value="Termo certo">Termo certo</option>
                            <option value="Termo incerto">Termo incerto</option>
                            <option value="Estágio">Estágio</option>
                            <option value="Prestação de serviços">Prestação de serviços</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>
                    <div id="func-fim-contrato-wrap" style="margin-bottom: 14px; display:none;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Data de Fim de Contrato</label>
                        <input type="date" id="func-fim-contrato" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                        <small style="color:var(--rh-text-subtle); font-size:11px;">Fim previsto do contrato (para contratos a termo/estágio). Permite alertas de renovação e relatórios de contratos a terminar.</small>
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Salário Base Bruto (€) *</label>
                        <input type="number" id="func-salario" min="0" step="0.01" placeholder="0.00" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Subsídio de Refeição (€/dia)</label>
                        <input type="number" id="func-subsidio-dia" min="0" step="0.01" placeholder="Vazio = usa o valor da empresa" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                        <small id="func-subsidio-ajuda" style="color:var(--rh-text-subtle); font-size:11px;">Deixe vazio para usar o valor definido na Parametrização da empresa.</small>
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Forma de pagamento do subsídio</label>
                        <select id="func-subsidio-modo" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px; background:var(--rh-bg-card);">
                            <option value="dinheiro" selected>Em dinheiro (no vencimento)</option>
                            <option value="cartao">Em cartão refeição (à parte)</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Categoria IRS</label>
                        <select id="func-irs" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px; background:var(--rh-bg-card);">
                            <option value="NHR">Não Habitual (NHR)</option>
                            <option value="solteiro" selected>Solteiro(a) sem dependentes</option>
                            <option value="casado1">Casado(a) — 1 titular</option>
                            <option value="casado2">Casado(a) — 2 titulares</option>
                            <option value="monoparental">Família monoparental</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">Taxa de Retenção IRS (%)</label>
                        <input type="number" id="func-taxa-irs" min="0" max="100" step="0.1" placeholder="Ex: 11.0" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;">
                        <small style="color:var(--rh-text-subtle); font-size:11px;">Definida conforme a tabela de retenção em vigor para a categoria/escalão do colaborador.</small>
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">🎓 Habilitações Literárias</label>
                        ${renderSelectQualificacao('func-qualificacao')}
                    </div>

                    <hr style="border:none; border-top:1px solid var(--rh-border); margin: 18px 0;">

                    ${renderHorarioTrabalho('novo')}

                    <hr style="border:none; border-top:1px solid var(--rh-border); margin: 18px 0;">

                    <h4 style="margin: 0 0 14px 0; color: var(--rh-primary); font-size: 14px;">🏦 Dados Bancários</h4>
                    <div style="margin-bottom: 14px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500; color:var(--rh-text-muted); font-size:13px;">NIB / IBAN</label>
                        <input type="text" id="func-nib" maxlength="25" placeholder="PT50 XXXX XXXX XXXX XXXX XXXX X" style="width:100%; padding:10px; border:1px solid var(--rh-border); border-radius:6px; box-sizing:border-box; font-size:14px;" oninput="window._criarFuncValidarNib(this.value)">
                        <small id="nib-estado" style="font-size:12px; margin-top:4px; display:block; color:var(--rh-text-subtle);">Opcional — se não preenchido, será sinalizado no dashboard.</small>
                    </div>
                </div>
            </div>

            <!-- Calendário de Férias -->
            <div style="background: var(--rh-bg-card); padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); margin-bottom: 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <div>
                        <h4 style="margin: 0; color: var(--rh-primary); border-bottom: 2px solid var(--rh-warning); padding-bottom: 8px; display:inline-block;">🏖️ Seleção de Dias de Férias</h4>
                        <p style="color:var(--rh-text-muted); font-size:13px; margin:8px 0 0 0;">Clique nos dias para marcar como férias. Dias a vermelho são feriados.</p>
                    </div>
                    <div style="text-align:right;">
                        <span id="ferias-contador" style="font-size:22px; font-weight:bold; color:var(--rh-warning);">0</span>
                        <span id="ferias-limite-label" style="font-size:13px; color:var(--rh-text-muted);"> / 22 dias selecionados</span>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                    <button id="cal-prev" style="background:var(--rh-bg-muted); border:none; border-radius:6px; padding:7px 14px; cursor:pointer; font-size:16px;">‹</button>
                    <span id="cal-mes-ano" style="font-weight:bold; font-size:16px; color:var(--rh-primary); min-width:160px; text-align:center;"></span>
                    <button id="cal-next" style="background:var(--rh-bg-muted); border:none; border-radius:6px; padding:7px 14px; cursor:pointer; font-size:16px;">›</button>
                    <button id="cal-limpar" style="margin-left:auto; background:var(--rh-danger-bg); border:none; border-radius:6px; padding:7px 14px; cursor:pointer; font-size:13px; color:var(--rh-danger-dark);">🗑 Limpar seleção</button>
                </div>

                <div id="calendario-ferias" style="user-select:none;"></div>

                <div style="display:flex; gap:16px; margin-top:14px; font-size:12px; color:var(--rh-text-muted);">
                    <span><span style="display:inline-block; width:14px; height:14px; background:var(--rh-warning-bg); border:1px solid var(--rh-warning); border-radius:3px; vertical-align:middle; margin-right:4px;"></span>Férias selecionadas</span>
                    <span><span style="display:inline-block; width:14px; height:14px; background:var(--rh-danger-bg); border:1px solid var(--rh-danger-dark); border-radius:3px; vertical-align:middle; margin-right:4px;"></span>Feriado</span>
                    <span><span style="display:inline-block; width:14px; height:14px; background:var(--rh-bg-muted); border:1px solid var(--rh-border); border-radius:3px; vertical-align:middle; margin-right:4px;"></span>Fim de semana</span>
                </div>
            </div>

            <!-- Ações -->
            <div style="display:flex; justify-content:flex-end; gap:12px;">
                <button onclick="window.router.navigate('dashboard')" style="background:var(--rh-bg-muted); border:none; padding:12px 28px; border-radius:6px; cursor:pointer; font-size:14px; color:var(--rh-text-muted);">Cancelar</button>
                <button id="btn-guardar-func" style="background-color:var(--rh-accent); color:var(--rh-text); border:none; padding:12px 30px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">💾 Criar Funcionário</button>
            </div>
        </main>
    </div>
    `;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// validarNIF e validarNIB importados de colaborador-utils.js (partilhados com a ficha)

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ─── Estado do calendário ──────────────────────────────────────────────────

let _calState = {
    ano: new Date().getFullYear(),
    mes: new Date().getMonth(),
    diasSelecionados: new Set(), // "YYYY-MM-DD"
    feriados: new Set(),         // "MM-DD"
    limiteFerias: 22,
};

function _renderCalendario() {
    const { ano, mes, diasSelecionados, feriados, limiteFerias } = _calState;
    const container = document.getElementById('calendario-ferias');
    const labelMesAno = document.getElementById('cal-mes-ano');
    const contador = document.getElementById('ferias-contador');
    const limiteLabel = document.getElementById('ferias-limite-label');

    if (!container) return;

    labelMesAno.textContent = `${MESES[mes]} ${ano}`;
    contador.textContent = diasSelecionados.size;
    limiteLabel.textContent = ` / ${limiteFerias} dias selecionados`;
    contador.style.color = diasSelecionados.size >= limiteFerias ? 'var(--rh-danger)' : 'var(--rh-warning)';

    const primeiroDia = new Date(ano, mes, 1).getDay();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();

    let html = `<div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px;">`;

    // Cabeçalho
    DIAS_SEMANA.forEach(d => {
        html += `<div style="text-align:center; font-size:11px; font-weight:bold; color:var(--rh-text-subtle); padding:6px 0;">${d}</div>`;
    });

    // Espaços em branco antes do dia 1
    for (let i = 0; i < primeiroDia; i++) {
        html += `<div></div>`;
    }

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dateStr = `${ano}-${String(mes + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        const feriadoKey = `${String(mes + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        const diaSemana = new Date(ano, mes, dia).getDay();
        const isWeekend = diaSemana === 0 || diaSemana === 6;
        const isFeriado = feriados.has(feriadoKey);
        const isSelecionado = diasSelecionados.has(dateStr);

        let bg = 'var(--rh-bg-card)';
        let border = '1px solid var(--rh-border)';
        let color = 'var(--rh-primary-dark)';
        let cursor = 'pointer';

        if (isFeriado) { bg = 'var(--rh-danger-bg)'; border = '1px solid var(--rh-danger-dark)'; color = 'var(--rh-danger-text)'; cursor = 'not-allowed'; }
        else if (isWeekend) { bg = 'var(--rh-bg-muted)'; color = 'var(--rh-text-subtle)'; cursor = 'not-allowed'; }
        if (isSelecionado) { bg = 'var(--rh-warning-bg)'; border = '2px solid var(--rh-warning)'; color = 'var(--rh-warning-text)'; }

        const clickable = !isWeekend && !isFeriado;
        const onclick = clickable ? `window._criarFuncToggleDia('${dateStr}')` : '';

        html += `<div onclick="${onclick}" style="text-align:center; padding:8px 4px; border-radius:6px; font-size:13px; background:${bg}; border:${border}; color:${color}; cursor:${cursor}; transition:background .15s;">
            ${dia}
        </div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// ─── Funções globais usadas pelo HTML inline ───────────────────────────────

window._criarFuncToggleDia = function(dateStr) {
    const { diasSelecionados, limiteFerias } = _calState;
    if (diasSelecionados.has(dateStr)) {
        diasSelecionados.delete(dateStr);
    } else {
        if (diasSelecionados.size >= limiteFerias) {
            alert(`Limite de ${limiteFerias} dias de férias atingido.`);
            return;
        }
        diasSelecionados.add(dateStr);
    }
    _renderCalendario();
};

window._criarFuncValidarNib = function(valor) {
    const estado = document.getElementById('nib-estado');
    if (!estado) return;
    if (!valor.trim()) {
        estado.textContent = 'Opcional — se não preenchido, será sinalizado no dashboard.';
        estado.style.color = 'var(--rh-text-subtle)';
        return;
    }
    if (validarNIB(valor)) {
        estado.textContent = '✔ NIB/IBAN válido.';
        estado.style.color = 'var(--rh-secondary)';
    } else {
        estado.textContent = '✖ Formato inválido. Use 21 dígitos (NIB) ou PTXX… (IBAN).';
        estado.style.color = 'var(--rh-danger)';
    }
};

// ─── Init ──────────────────────────────────────────────────────────────────

export async function init() {
    await initSidebar();

    // Estado de filhos: novo funcionário começa sem filhos registados
    inicializarFilhosState('novo', []);

    // Carregar parâmetros: limite de férias e feriados activos
    try {
        const paramSnap = await getDoc(docEmpresa('configuracoes', 'empresa_base'));
        if (paramSnap.exists()) {
            const dados = paramSnap.data();
            if (dados.limiteDiasFerias) _calState.limiteFerias = dados.limiteDiasFerias;
            // feriados activos guardados como nomes; precisa de datas → usa calcularFeriados
            const ano = _calState.ano;
            const feriadosLista = _calcularFeriadosPortugal(ano);
            const ativos = dados.feriadosAtivos || feriadosLista.map(f => f.nome);
            feriadosLista.forEach(f => {
                if (ativos.includes(f.nome)) _calState.feriados.add(f.data);
            });
            // feriados locais
            if (dados.feriadosLocais) {
                dados.feriadosLocais.split(',').forEach(s => {
                    const p = s.trim().match(/^(\d{2})\/(\d{2})$/);
                    if (p) _calState.feriados.add(`${p[2]}-${p[1]}`);
                });
            }
            // actualizar label limite
            const ll = document.getElementById('ferias-limite-label');
            if (ll) ll.textContent = ` / ${_calState.limiteFerias} dias selecionados`;
            // Mostra o valor atual da empresa no texto de ajuda do subsídio
            const subAjuda = document.getElementById('func-subsidio-ajuda');
            if (subAjuda) {
                const v = Number(dados.subsidioRefeicao || 0);
                subAjuda.textContent = `Deixe vazio para usar o valor da empresa (atualmente ${v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}/dia). Defina-o na Parametrização se estiver a 0.`;
            }
        }
    } catch (e) { console.warn('Não foi possível carregar parâmetros:', e); }

    // Mostrar/ocultar a data de fim de contrato conforme o tipo
    window._funcToggleFim = function() {
        const tipo = document.getElementById('func-tipo-contrato')?.value;
        const wrap = document.getElementById('func-fim-contrato-wrap');
        if (wrap) wrap.style.display = (tipo && tipo !== 'Sem termo') ? 'block' : 'none';
    };
    window._funcToggleFim();

    _renderCalendario();

    document.getElementById('cal-prev').addEventListener('click', () => {
        if (_calState.mes === 0) { _calState.mes = 11; _calState.ano--; }
        else _calState.mes--;
        _renderCalendario();
    });

    document.getElementById('cal-next').addEventListener('click', () => {
        if (_calState.mes === 11) { _calState.mes = 0; _calState.ano++; }
        else _calState.mes++;
        _renderCalendario();
    });

    document.getElementById('cal-limpar').addEventListener('click', () => {
        _calState.diasSelecionados.clear();
        _renderCalendario();
    });

    document.getElementById('btn-guardar-func').addEventListener('click', async () => {
        const nome = document.getElementById('func-nome').value.trim();
        const nif  = document.getElementById('func-nif').value.trim();
        const nib  = document.getElementById('func-nib').value.trim();

        // Validações obrigatórias
        if (!nome) { alert('O nome do funcionário é obrigatório.'); return; }
        if (!validarNIF(nif)) {
            document.getElementById('nif-erro').style.display = 'block';
            document.getElementById('func-nif').focus();
            return;
        }
        document.getElementById('nif-erro').style.display = 'none';

        const admissao = document.getElementById('func-admissao').value;
        if (!admissao) { alert('A data de admissão é obrigatória.'); return; }

        const salario = parseFloat(document.getElementById('func-salario').value);
        if (isNaN(salario) || salario <= 0) { alert('Insira um salário base válido.'); return; }

        // Aviso NIB (não bloqueia)
        const nibValido = nib !== '' && validarNIB(nib);
        if (!nibValido) {
            document.getElementById('aviso-nib-form').style.display = 'block';
        }

        const btn = document.getElementById('btn-guardar-func');
        btn.textContent = 'A guardar...';
        btn.disabled = true;

        const funcionario = {
            nome,
            nif,
            nib: nib || null,
            nibValido,
            morada:       document.getElementById('func-morada').value.trim(),
            codigoPostal: document.getElementById('func-codigo-postal').value.trim(),
            nacionalidade: document.getElementById('func-nacionalidade').value.trim(),
            contacto:     document.getElementById('func-contacto').value.trim(),
            email:        document.getElementById('func-email').value.trim(),
            nascimento:   document.getElementById('func-nascimento').value || null,
            estadoCivil:  document.getElementById('func-estado-civil').value || null,
            cargo:        document.getElementById('func-cargo').value.trim(),
            departamento: document.getElementById('func-departamento').value.trim(),
            admissao,
            tipoContrato: document.getElementById('func-tipo-contrato').value,
            dataFimContrato: (document.getElementById('func-tipo-contrato').value !== 'Sem termo' && document.getElementById('func-fim-contrato').value) ? document.getElementById('func-fim-contrato').value : null,
            salarioBase:  salario,
            subsidioRefeicaoDia: (document.getElementById('func-subsidio-dia').value === '' ? null : parseFloat(document.getElementById('func-subsidio-dia').value)),
            subsidioRefeicaoModo: document.getElementById('func-subsidio-modo').value,
            categoriaIRS: document.getElementById('func-irs').value,
            taxaIRS: parseFloat(document.getElementById('func-taxa-irs').value) || 0,
            qualificacao: document.getElementById('func-qualificacao').value || null,
            diasFerias:   Array.from(_calState.diasSelecionados).sort(),
            filhos:       obterFilhosState('novo'),
            horarioTrabalho: lerHorarioTrabalhoDoForm('novo'),
            criadoEm:     new Date().toISOString(),
            ativo: true,
        };

        try {
            await addDoc(colEmpresa('funcionarios'), funcionario);
            // Se não tem NIB, registar alerta no dashboard
            if (!nibValido) {
                await addDoc(colEmpresa('alertas_dashboard'), {
                    tipo: 'nib_em_falta',
                    mensagem: `O funcionário ${nome} (NIF: ${nif}) ainda não forneceu NIB.`,
                    nif,
                    nome,
                    resolvido: false,
                    criadoEm: new Date().toISOString(),
                });
            }
            alert(`Funcionário "${nome}" criado com sucesso!`);
            // Limpar estado do calendário para próxima utilização
            _calState.diasSelecionados.clear();
            window.router.navigate('dashboard');
        } catch (err) {
            console.error(err);
            alert('Erro ao guardar: ' + err.message);
            btn.textContent = '💾 Criar Funcionário';
            btn.disabled = false;
        }
    });
}

// ─── Cópia local do cálculo de feriados (evita dependência circular) ───────

function _calcularFeriadosPortugal(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mesPascoa = Math.floor((h + l - 7 * m + 114) / 31);
    const diaPascoa = ((h + l - 7 * m + 114) % 31) + 1;
    const pascoa = new Date(ano, mesPascoa - 1, diaPascoa);
    const add = (d, n) => { const x = new Date(d); x.setDate(d.getDate() + n); return x; };
    const fmt = d => `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return [
        { data: '01-01', nome: 'Ano Novo' },
        { data: fmt(add(pascoa,-47)), nome: 'Carnaval' },
        { data: fmt(add(pascoa,-2)),  nome: 'Sexta-feira Santa' },
        { data: fmt(pascoa),          nome: 'Páscoa' },
        { data: '04-25', nome: 'Dia da Liberdade' },
        { data: '05-01', nome: 'Dia do Trabalhador' },
        { data: fmt(add(pascoa,60)), nome: 'Corpo de Deus' },
        { data: '06-10', nome: 'Dia de Portugal' },
        { data: '08-15', nome: 'Assunção de N. Sra.' },
        { data: '10-05', nome: 'Implantação da República' },
        { data: '11-01', nome: 'Todos os Santos' },
        { data: '12-01', nome: 'Restauração da Independência' },
        { data: '12-08', nome: 'Imaculada Conceição' },
        { data: '12-25', nome: 'Natal' },
    ];
}
