// assets/js/modules/ficha-funcionario.js
import { getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { calcularDireitoFerias, feriadosPortugal } from './ferias-utils.js';
import { renderHorarioTrabalho, lerHorarioTrabalhoDoForm, renderFilhosSection, inicializarFilhosState, obterFilhosState, definirContextoFuncionario, renderSelectQualificacao, renderSelectEstadoCivil, validarNIB, validarNIF } from './colaborador-utils.js';
import { eliminarComBackup } from './seguranca-dados.js';
import { docEmpresa } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';

// calcularDireitoFerias e feriadosPortugal importados de ferias-utils.js

// ─── Estado do módulo ─────────────────────────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

let S = {
    funcId: null,
    func: null,
    ano: new Date().getFullYear(),
    mes: new Date().getMonth(),
    feriados: new Set(),     // "MM-DD"
    limiteDiasFerias: 22,
    direitoAno: 22,
};

// ─── Calendário ───────────────────────────────────────────────────────────────
function renderCal() {
    const cont = document.getElementById('ficha-cal');
    const lblMes = document.getElementById('ficha-cal-label');
    if (!cont || !lblMes || !S.func) return;

    lblMes.textContent = `${MESES[S.mes]} ${S.ano}`;

    const diasFerias  = new Set(S.func.diasFerias  || []);
    const diasGozados = new Set(S.func.diasGozados || []);
    const hoje = new Date();
    const primeiroDia = new Date(S.ano, S.mes, 1).getDay();
    const diasNoMes   = new Date(S.ano, S.mes + 1, 0).getDate();

    let h = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">`;

    DIAS_SEMANA.forEach(d =>
        h += `<div style="text-align:center;font-size:11px;font-weight:bold;color:var(--rh-text-subtle);padding:5px 0;">${d}</div>`
    );
    for (let i = 0; i < primeiroDia; i++) h += `<div></div>`;

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const ds  = `${S.ano}-${String(S.mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        const fk  = `${String(S.mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        const dow = new Date(S.ano, S.mes, dia).getDay();
        const isWeekend  = dow === 0 || dow === 6;
        const isFeriado  = S.feriados.has(fk);
        const isGozado   = diasGozados.has(ds);
        const isMarcado  = diasFerias.has(ds);
        const isHoje     = hoje.getFullYear()===S.ano && hoje.getMonth()===S.mes && hoje.getDate()===dia;

        let bg='var(--rh-bg-card)', border='1px solid var(--rh-border)', color='var(--rh-primary-dark)', cursor='pointer', title='';

        if (isWeekend)  { bg='var(--rh-bg-muted)'; color='var(--rh-border)'; cursor='default'; }
        if (isFeriado)  { bg='var(--rh-danger-bg)'; border='1px solid var(--rh-danger-dark)'; color='var(--rh-danger-text)'; cursor='default'; title='Feriado'; }

        // estados de férias sobrepõem-se (gozado > marcado)
        if (isGozado)        { bg='var(--rh-danger-bg)'; border='2px solid var(--rh-danger)'; color='var(--rh-danger-text)'; cursor='pointer'; title='Gozado — clique para desmarcar'; }
        else if (isMarcado)  { bg='var(--rh-success-bg)'; border='2px solid var(--rh-success)'; color='var(--rh-success-text)'; cursor='pointer'; title='Marcado — clique para marcar como gozado'; }
        else if (!isWeekend && !isFeriado) { title='Clique para marcar como férias'; }

        if (isHoje) border = (isGozado||isMarcado) ? border : '2px solid var(--rh-primary)';

        const clickable = !isWeekend && !isFeriado;
        const onclick = clickable ? `window._fichaToggle('${ds}')` : '';

        h += `<div onclick="${onclick}" title="${title}"
            style="text-align:center;padding:8px 2px;border-radius:6px;font-size:12px;
                   background:${bg};border:${border};color:${color};cursor:${cursor};
                   font-weight:${isHoje?'bold':'normal'};transition:all .1s;">
            ${dia}</div>`;
    }
    h += `</div>`;
    cont.innerHTML = h;
    renderContadores();
    renderLista();
}

function renderContadores() {
    const anoStr = String(S.ano);
    const marcados  = (S.func.diasFerias  || []).filter(d => d.startsWith(anoStr)).length;
    const gozados   = (S.func.diasGozados || []).filter(d => d.startsWith(anoStr)).length;
    const porGozar  = Math.max(marcados - gozados, 0);
    const disponiveis = Math.max(S.direitoAno - marcados, 0);

    const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    set('kpi-direito',     S.direitoAno);
    set('kpi-marcados',    marcados);
    set('kpi-gozados',     gozados);
    set('kpi-porgozar',    porGozar);
    set('kpi-disponiveis', disponiveis);
}

function renderLista() {
    const cont = document.getElementById('ficha-lista');
    if (!cont) return;
    const anoStr = String(S.ano);
    const diasFerias  = (S.func.diasFerias  || []).filter(d => d.startsWith(anoStr));
    const gozSet      = new Set((S.func.diasGozados || []).filter(d => d.startsWith(anoStr)));

    if (!diasFerias.length) {
        cont.innerHTML = `<p style="color:var(--rh-text-subtle);font-style:italic;margin:0;font-size:13px;">Nenhum dia marcado em ${S.ano}.</p>`;
        return;
    }
    cont.innerHTML = diasFerias.map(d => {
        const g = gozSet.has(d);
        const fmt = new Date(d+'T00:00:00').toLocaleDateString('pt-PT',{day:'2-digit',month:'long',weekday:'short'});
        const badge = g
            ? `<span style="background:var(--rh-danger-bg);color:var(--rh-danger-text);padding:2px 9px;border-radius:10px;font-size:11px;">Gozado</span>`
            : `<span style="background:var(--rh-success-bg);color:var(--rh-success-text);padding:2px 9px;border-radius:10px;font-size:11px;">Marcado</span>`;
        return `<div style="display:flex;justify-content:space-between;align-items:center;
                            padding:6px 0;border-bottom:1px solid var(--rh-bg-muted);font-size:12px;">
            <span style="color:var(--rh-primary-dark);">${fmt}</span>${badge}</div>`;
    }).join('');
}

// ─── Toggle: branco → verde → vermelho → branco ───────────────────────────────
window._fichaToggle = function(ds) {
    const diasFerias  = new Set(S.func.diasFerias  || []);
    const diasGozados = new Set(S.func.diasGozados || []);
    const anoStr = String(S.ano);

    if (diasGozados.has(ds)) {
        // vermelho → branco: desmarcar tudo
        diasGozados.delete(ds);
        diasFerias.delete(ds);
    } else if (diasFerias.has(ds)) {
        // verde → vermelho
        diasGozados.add(ds);
    } else {
        // branco → verde: verificar limite
        const marcadosAno = [...diasFerias].filter(d => d.startsWith(anoStr)).length;
        if (marcadosAno >= S.direitoAno) {
            alert(`Limite de ${S.direitoAno} dias de férias atingido para ${S.ano}.`);
            return;
        }
        diasFerias.add(ds);
    }

    S.func.diasFerias  = [...diasFerias].sort();
    S.func.diasGozados = [...diasGozados].sort();
    renderCal();
};

window._fichaMarcarPassados = function() {
    const hoje = new Date().toISOString().slice(0,10);
    const diasFerias  = new Set(S.func.diasFerias  || []);
    const diasGozados = new Set(S.func.diasGozados || []);
    let n = 0;
    diasFerias.forEach(d => { if (d < hoje && !diasGozados.has(d)) { diasGozados.add(d); n++; } });
    if (!n) { alert('Não há dias anteriores a hoje por marcar como gozados.'); return; }
    S.func.diasGozados = [...diasGozados].sort();
    renderCal();
};

window._fichaGuardar = async function() {
    const btn = document.getElementById('btn-guardar');
    if (!btn || !S.funcId) return;
    btn.textContent = 'A guardar…'; btn.disabled = true;
    try {
        await updateDoc(docEmpresa('funcionarios', S.funcId), {
            diasFerias:  S.func.diasFerias  || [],
            diasGozados: S.func.diasGozados || [],
        });
        btn.textContent = '✔ Guardado!';
        setTimeout(() => { btn.textContent = '💾 Guardar'; btn.disabled = false; }, 2000);
    } catch (e) {
        alert('Erro: ' + e.message);
        btn.textContent = '💾 Guardar'; btn.disabled = false;
    }
};

window._fichaChangeAno = function(v) {
    S.ano = parseInt(v);
    S.direitoAno = calcularDireitoFerias(S.func.admissao, S.ano, S.limiteDiasFerias);
    renderCal();
};

window._fichaGuardarFilhos = async function() {
    const btn = document.getElementById('btn-guardar-filhos');
    if (!btn || !S.funcId) return;
    btn.textContent = 'A guardar…'; btn.disabled = true;
    try {
        const filhos = obterFilhosState('ficha');
        await updateDoc(docEmpresa('funcionarios', S.funcId), { filhos });
        S.func.filhos = filhos;
        btn.textContent = '✔ Guardado!';
        setTimeout(() => { btn.textContent = '💾 Guardar Filhos'; btn.disabled = false; }, 2000);
    } catch (e) {
        alert('Erro: ' + e.message);
        btn.textContent = '💾 Guardar Filhos'; btn.disabled = false;
    }
};

window._fichaGuardarHorario = async function() {
    const btn = document.getElementById('btn-guardar-horario');
    if (!btn || !S.funcId) return;
    btn.textContent = 'A guardar…'; btn.disabled = true;
    try {
        const horarioTrabalho = lerHorarioTrabalhoDoForm('ficha');
        await updateDoc(docEmpresa('funcionarios', S.funcId), { horarioTrabalho });
        S.func.horarioTrabalho = horarioTrabalho;
        btn.textContent = '✔ Guardado!';
        setTimeout(() => { btn.textContent = '💾 Guardar Horário'; btn.disabled = false; }, 2000);
    } catch (e) {
        alert('Erro: ' + e.message);
        btn.textContent = '💾 Guardar Horário'; btn.disabled = false;
    }
};

window._fichaGuardarPessoais = async function() {
    const btn = document.getElementById('btn-guardar-pessoais');
    if (!btn || !S.funcId) return;

    const nome = document.getElementById('ficha-pess-nome').value.trim();
    const nif = document.getElementById('ficha-pess-nif').value.trim();
    const nascimento = document.getElementById('ficha-pess-nascimento').value || null;
    const estadoCivil = document.getElementById('ficha-pess-estado-civil').value || null;
    const morada = document.getElementById('ficha-pess-morada').value.trim();
    const codigoPostal = document.getElementById('ficha-pess-codigo-postal').value.trim();
    const nacionalidade = document.getElementById('ficha-pess-nacionalidade').value.trim();
    const contacto = document.getElementById('ficha-pess-contacto').value.trim();
    const email = document.getElementById('ficha-pess-email').value.trim();
    const nib = document.getElementById('ficha-pess-nib').value.trim();

    if (!nome) { alert('O nome completo é obrigatório.'); return; }
    if (!validarNIF(nif)) {
        alert('O NIF está errado. Verifique e introduza um NIF válido (9 dígitos, com dígito de controlo correto).');
        document.getElementById('ficha-pess-nif').focus();
        return;
    }

    btn.textContent = 'A guardar…'; btn.disabled = true;
    try {
        const nibValido = nib !== '' && validarNIB(nib);
        const dadosPess = { nome, nif, nascimento, estadoCivil, morada, codigoPostal, nacionalidade, contacto, email, nib, nibValido };
        await updateDoc(docEmpresa('funcionarios', S.funcId), dadosPess);
        Object.assign(S.func, dadosPess);
        document.getElementById('ficha-titulo').textContent = S.func.nome || 'Colaborador';
        document.getElementById('ficha-sub').textContent =
            `NIF: ${S.func.nif||'—'}  ·  ${S.func.cargo||''}  ·  Admissão: ${S.func.admissao ? new Date(S.func.admissao+'T00:00:00').toLocaleDateString('pt-PT') : '—'}`;
        btn.textContent = '✔ Guardado!';
        setTimeout(() => { btn.textContent = '💾 Guardar Dados Pessoais'; btn.disabled = false; }, 2000);
    } catch (e) {
        alert('Erro: ' + e.message);
        btn.textContent = '💾 Guardar Dados Pessoais'; btn.disabled = false;
    }
};

window._fichaGuardarProfissionais = async function() {
    const btn = document.getElementById('btn-guardar-prof');
    if (!btn || !S.funcId) return;

    const cargo = document.getElementById('ficha-prof-cargo').value.trim();
    const departamento = document.getElementById('ficha-prof-departamento').value.trim();
    const admissao = document.getElementById('ficha-prof-admissao').value;
    const salarioBase = parseFloat(document.getElementById('ficha-prof-salario').value) || 0;
    const subDiaRaw = document.getElementById('ficha-prof-subsidio-dia').value;
    const subsidioRefeicaoDia = subDiaRaw === '' ? null : (parseFloat(subDiaRaw) || 0);
    const subsidioRefeicaoModo = document.getElementById('ficha-prof-subsidio-modo').value;
    const dataCessacao = document.getElementById('ficha-prof-cessacao').value || null;
    const tipoContrato = document.getElementById('ficha-prof-tipo-contrato').value;
    const dataFimContrato = (tipoContrato !== 'Sem termo' && document.getElementById('ficha-prof-fim-contrato').value) ? document.getElementById('ficha-prof-fim-contrato').value : null;
    const motivoCessacao = document.getElementById('ficha-prof-motivo-cessacao').value || null;
    const categoriaIRS = document.getElementById('ficha-prof-irs').value;
    const taxaIRS = parseFloat(document.getElementById('ficha-prof-taxa-irs').value);
    const qualificacao = document.getElementById('ficha-prof-qualificacao').value || null;

    if (!admissao) { alert('A data de admissão é obrigatória.'); return; }

    btn.textContent = 'A guardar…'; btn.disabled = true;
    try {
        const dadosProf = { cargo, departamento, admissao, tipoContrato, dataFimContrato, dataCessacao, motivoCessacao, salarioBase, subsidioRefeicaoDia, subsidioRefeicaoModo, categoriaIRS, taxaIRS: isNaN(taxaIRS) ? 0 : taxaIRS, qualificacao };
        await updateDoc(docEmpresa('funcionarios', S.funcId), dadosProf);
        Object.assign(S.func, dadosProf);
        // O direito a férias depende da data de admissão: recalcula caso tenha mudado
        S.direitoAno = calcularDireitoFerias(S.func.admissao, S.ano, S.limiteDiasFerias);
        renderCal();
        document.getElementById('ficha-sub').textContent =
            `NIF: ${S.func.nif||'—'}  ·  ${S.func.cargo||''}  ·  Admissão: ${S.func.admissao ? new Date(S.func.admissao+'T00:00:00').toLocaleDateString('pt-PT') : '—'}`;
        btn.textContent = '✔ Guardado!';
        setTimeout(() => { btn.textContent = '💾 Guardar Dados Profissionais'; btn.disabled = false; }, 2000);
    } catch (e) {
        alert('Erro: ' + e.message);
        btn.textContent = '💾 Guardar Dados Profissionais'; btn.disabled = false;
    }
};

window._fichaEliminarFuncionario = async function() {
    if (!S.funcId || !S.func) return;

    // Junta as ausências associadas ao mesmo backup, para permitir reposição completa.
    let ausenciasAssociadas = null;
    try {
        const ausSnap = await getDoc(docEmpresa('ausencias', S.funcId));
        if (ausSnap.exists()) ausenciasAssociadas = ausSnap.data();
    } catch (e) { /* sem ausências, ignora */ }

    const ok = await eliminarComBackup({
        colecao: 'funcionarios',
        docId: S.funcId,
        dados: { funcionario: S.func, ausencias: ausenciasAssociadas },
        tipo: 'funcionario',
        descricao: `${S.func.nome || S.funcId} (NIF ${S.func.nif || '—'})`,
        mensagemConfirmacao: `O colaborador "${S.func.nome}" e o seu histórico de ausências serão eliminados. Os dados ficam guardados na lixeira (Lixo / Repor Dados). Introduza a sua password para confirmar.`,
        onUpdateDoc: async () => {
            await deleteDoc(docEmpresa('funcionarios', S.funcId));
            if (ausenciasAssociadas) await deleteDoc(docEmpresa('ausencias', S.funcId));
        },
    });

    if (ok) {
        alert('Colaborador eliminado. Os dados ficam disponíveis em "Lixo / Repor Dados".');
        window.router.navigate('funcionarios');
    }
};

// ─── render() ─────────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">

        ${renderSidebarHTML('funcionarios')}

        <!-- Main -->
        <main style="flex:1;padding:28px;overflow-y:auto;">

            <!-- Header -->
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:22px;">
                <button onclick="window.router.navigate('funcionarios')"
                    style="background:none;border:1px solid var(--rh-border);padding:7px 14px;border-radius:6px;cursor:pointer;color:var(--rh-text-muted);font-size:13px;">← Colaboradores</button>
                <div style="flex:1;">
                    <h2 id="ficha-titulo" style="margin:0;font-size:21px;color:var(--rh-primary);">Ficha do Colaborador</h2>
                    <p id="ficha-sub" style="margin:3px 0 0;font-size:13px;color:var(--rh-text-muted);">A carregar…</p>
                </div>
                <button onclick="window._fichaEliminarFuncionario()"
                    style="background:var(--rh-danger-bg);color:var(--rh-danger-text);border:1px solid var(--rh-danger);padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;">🗑️ Eliminar</button>
                <button onclick="window.router.navigate('dashboard')"
                    style="background:var(--rh-bg-muted);color:var(--rh-text-muted);border:1px solid var(--rh-border);padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;">✕ Fechar</button>
            </div>

            <!-- KPIs -->
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:22px;">
                ${[
                    ['kpi-direito',     'var(--rh-primary)', 'Direito',      'dias este ano'],
                    ['kpi-marcados',    'var(--rh-success)', 'Marcados',     'férias planeadas'],
                    ['kpi-gozados',     'var(--rh-danger)', 'Gozados',      'já concluídos'],
                    ['kpi-porgozar',    'var(--rh-warning)', 'Por gozar',    'marcados p/ gozar'],
                    ['kpi-disponiveis', '#8b5cf6', 'Disponíveis',  'ainda por marcar'],
                ].map(([id,cor,label,sub]) => `
                <div style="background:var(--rh-bg-card);padding:16px;border-radius:10px;border-top:3px solid ${cor};
                            box-shadow:0 2px 4px rgba(0,0,0,0.04);text-align:center;">
                    <div style="font-size:10px;color:var(--rh-text-muted);text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${label}</div>
                    <div id="${id}" style="font-size:28px;font-weight:bold;color:var(--rh-primary);">—</div>
                    <div style="font-size:11px;color:var(--rh-text-subtle);margin-top:2px;">${sub}</div>
                </div>`).join('')}
            </div>

            <!-- Dados Pessoais -->
            <div style="background:var(--rh-bg-card);padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);margin-bottom:18px;">
                <h4 style="margin:0 0 14px;color:var(--rh-primary);font-size:13px;border-bottom:2px solid var(--rh-primary);padding-bottom:7px;">👤 Dados Pessoais</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Nome Completo</label>
                        <input type="text" id="ficha-pess-nome" placeholder="Ex: Ana Silva"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">NIF</label>
                        <input type="text" id="ficha-pess-nif" placeholder="9 dígitos"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Data de Nascimento</label>
                        <input type="date" id="ficha-pess-nascimento"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">💍 Estado Civil</label>
                        <div id="ficha-pess-estado-civil-wrap"></div>
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Morada</label>
                        <input type="text" id="ficha-pess-morada" placeholder="Rua, número, localidade"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Código Postal</label>
                        <input type="text" id="ficha-pess-codigo-postal" placeholder="0000-000 Localidade"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Nacionalidade</label>
                        <input type="text" id="ficha-pess-nacionalidade" placeholder="ex.: Portuguesa"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Contacto Telefónico</label>
                        <input type="text" id="ficha-pess-contacto" placeholder="9XX XXX XXX"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Email</label>
                        <input type="email" id="ficha-pess-email" placeholder="colaborador@empresa.pt"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">NIB / IBAN</label>
                        <input type="text" id="ficha-pess-nib" maxlength="25" placeholder="PT50 XXXX XXXX XXXX XXXX XXXX X"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                </div>
                <div style="font-size:11px;color:var(--rh-text-subtle);margin-bottom:10px;" id="ficha-pess-filhos-info"></div>
                <button id="btn-guardar-pessoais" onclick="window._fichaGuardarPessoais()"
                    style="background:var(--rh-secondary);color:var(--rh-bg-card);border:none;padding:9px 20px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">
                    💾 Guardar Dados Pessoais
                </button>
            </div>

            <!-- Calendário (largura total) -->
            <div style="background:var(--rh-bg-card);padding:22px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                    <h4 style="margin:0;color:var(--rh-primary);font-size:15px;">🗓️ Calendário de Férias</h4>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <select id="ficha-sel-ano" onchange="window._fichaChangeAno(this.value)"
                            style="padding:5px 10px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;background:var(--rh-bg-card);"></select>
                        <button id="cal-prev" style="background:var(--rh-bg-muted);border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:14px;">‹</button>
                        <span id="ficha-cal-label" style="font-weight:bold;font-size:13px;color:var(--rh-primary);min-width:125px;text-align:center;"></span>
                        <button id="cal-next" style="background:var(--rh-bg-muted);border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:14px;">›</button>
                    </div>
                </div>

                <div id="ficha-cal" style="user-select:none;"></div>

                <!-- Legenda -->
                <div style="display:flex;gap:14px;margin-top:12px;font-size:11px;color:var(--rh-text-muted);flex-wrap:wrap;">
                    <span><i style="display:inline-block;width:11px;height:11px;background:var(--rh-success-bg);border:1px solid var(--rh-success);border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Marcado</span>
                    <span><i style="display:inline-block;width:11px;height:11px;background:var(--rh-danger-bg);border:1px solid var(--rh-danger);border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Gozado</span>
                    <span><i style="display:inline-block;width:11px;height:11px;background:var(--rh-danger-bg);border:1px solid var(--rh-danger-dark);border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Feriado</span>
                    <span><i style="display:inline-block;width:11px;height:11px;background:var(--rh-bg-muted);border:1px solid var(--rh-border);border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Fim de semana</span>
                </div>
                <p style="font-size:11px;color:var(--rh-text-subtle);margin:8px 0 0;">
                    💡 1.º clique = marcar (🟢) · 2.º clique = gozado (🔴) · 3.º clique = remover
                </p>

                <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
                    <button onclick="window._fichaMarcarPassados()"
                        style="background:var(--rh-bg-muted);border:1px solid var(--rh-border);padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px;color:var(--rh-text-muted);">
                        ✔ Marcar passados como gozados
                    </button>
                    <button id="btn-guardar" onclick="window._fichaGuardar()"
                        style="margin-left:auto;background:var(--rh-secondary);color:var(--rh-bg-card);border:none;padding:8px 20px;
                               border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">
                        💾 Guardar
                    </button>
                </div>
            </div>

            <!-- Filhos · Horário · Dados Profissionais · Dias Marcados (lado a lado) -->
            <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">

                <!-- Filhos / Dependentes -->
                <div style="flex:1 1 0;min-width:260px;background:var(--rh-bg-card);padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                    <h4 style="margin:0 0 14px;color:var(--rh-primary);font-size:13px;border-bottom:2px solid var(--rh-secondary);padding-bottom:7px;">👶 Filhos / Dependentes</h4>
                    ${renderFilhosSection('ficha')}
                    <button id="btn-guardar-filhos" onclick="window._fichaGuardarFilhos()"
                        style="width:100%;margin-top:8px;background:var(--rh-secondary);color:var(--rh-bg-card);border:none;padding:9px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">
                        💾 Guardar Filhos
                    </button>
                </div>

                <!-- Horário de Trabalho -->
                <div style="flex:1 1 0;min-width:260px;background:var(--rh-bg-card);padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                    <h4 style="margin:0 0 14px;color:var(--rh-primary);font-size:13px;border-bottom:2px solid var(--rh-secondary);padding-bottom:7px;">⏰ Horário de Trabalho</h4>
                    ${renderHorarioTrabalho('ficha')}
                    <button id="btn-guardar-horario" onclick="window._fichaGuardarHorario()"
                        style="width:100%;margin-top:4px;background:var(--rh-secondary);color:var(--rh-bg-card);border:none;padding:9px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">
                        💾 Guardar Horário
                    </button>
                </div>

                <!-- Dados profissionais -->
                <div style="flex:1 1 0;min-width:260px;background:var(--rh-bg-card);padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                    <h4 style="margin:0 0 14px;color:var(--rh-primary);font-size:13px;border-bottom:2px solid var(--rh-secondary);padding-bottom:7px;">💼 Dados Profissionais</h4>

                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Cargo / Função</label>
                        <input type="text" id="ficha-prof-cargo" placeholder="Ex: Técnico de RH"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Departamento</label>
                        <input type="text" id="ficha-prof-departamento" placeholder="Ex: Recursos Humanos"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Data de Admissão</label>
                        <input type="date" id="ficha-prof-admissao"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Tipo de Contrato</label>
                        <select id="ficha-prof-tipo-contrato" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;background:var(--rh-bg-card);">
                            <option value="Sem termo">Sem termo</option>
                            <option value="Termo certo">Termo certo</option>
                            <option value="Termo incerto">Termo incerto</option>
                            <option value="Estágio">Estágio</option>
                            <option value="Prestação de serviços">Prestação de serviços</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Data de Fim de Contrato (se aplicável)</label>
                        <input type="date" id="ficha-prof-fim-contrato"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                        <small style="color:var(--rh-text-subtle);font-size:10px;">Fim previsto do contrato a termo/estágio (para alertas de renovação e relatórios de contratos a terminar).</small>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Data de Rescisão / Cessação (se aplicável)</label>
                        <input type="date" id="ficha-prof-cessacao"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                        <small style="color:var(--rh-text-subtle);font-size:10px;">Saída efetiva. O último mês é processado em proporção; depois deixa de ser processado.</small>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Motivo da Rescisão / Cessação</label>
                        <select id="ficha-prof-motivo-cessacao" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;background:var(--rh-bg-card);">
                            <option value="">—</option>
                            <option value="Acordo mútuo">Acordo mútuo</option>
                            <option value="Caducidade">Caducidade (fim do termo)</option>
                            <option value="Despedimento por iniciativa do trabalhador">Iniciativa do trabalhador</option>
                            <option value="Despedimento por iniciativa da empresa">Iniciativa da empresa</option>
                            <option value="Reforma">Reforma</option>
                            <option value="Falecimento">Falecimento</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Salário Base Bruto (€)</label>
                        <input type="number" id="ficha-prof-salario" min="0" step="0.01" placeholder="0.00"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Subsídio de Refeição (€/dia)</label>
                        <input type="number" id="ficha-prof-subsidio-dia" min="0" step="0.01" placeholder="Vazio = valor da empresa"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Forma de pagamento do subsídio</label>
                        <select id="ficha-prof-subsidio-modo" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;background:var(--rh-bg-card);">
                            <option value="dinheiro">Em dinheiro (no vencimento)</option>
                            <option value="cartao">Em cartão refeição (à parte)</option>
                        </select>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Categoria IRS</label>
                        <select id="ficha-prof-irs" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;background:var(--rh-bg-card);">
                            <option value="NHR">Não Habitual (NHR)</option>
                            <option value="solteiro">Solteiro(a) sem dependentes</option>
                            <option value="casado1">Casado(a) — 1 titular</option>
                            <option value="casado2">Casado(a) — 2 titulares</option>
                            <option value="monoparental">Família monoparental</option>
                        </select>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">Taxa de Retenção IRS (%)</label>
                        <input type="number" id="ficha-prof-taxa-irs" min="0" max="100" step="0.1" placeholder="Ex: 11.0"
                            style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:5px;font-size:12px;box-sizing:border-box;">
                        <small style="color:var(--rh-text-subtle);font-size:10px;display:block;margin-top:3px;">
                            Definida manualmente conforme a tabela de retenção em vigor para a categoria/escalão do colaborador.
                        </small>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;margin-bottom:4px;font-size:11px;color:var(--rh-text-subtle);">🎓 Habilitações Literárias</label>
                        <div id="ficha-prof-qualificacao-wrap" style="font-size:12px;"></div>
                    </div>
                    <div style="font-size:11px;color:var(--rh-text-subtle);margin-bottom:8px;" id="ficha-prof-horario-info"></div>

                    <button id="btn-guardar-prof" onclick="window._fichaGuardarProfissionais()"
                        style="width:100%;margin-top:4px;background:var(--rh-secondary);color:var(--rh-bg-card);border:none;padding:9px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">
                        💾 Guardar Dados Profissionais
                    </button>
                </div>

                <!-- Lista de dias -->
                <div style="flex:1 1 0;min-width:260px;background:var(--rh-bg-card);padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                    <h4 style="margin:0 0 14px;color:var(--rh-primary);font-size:13px;border-bottom:2px solid var(--rh-warning);padding-bottom:7px;">📋 Dias Marcados</h4>
                    <div id="ficha-lista" style="max-height:200px;overflow-y:auto;"></div>
                </div>
            </div>
        </main>
    </div>`;
}

// ─── init() ───────────────────────────────────────────────────────────────────
export async function init() {
    await initSidebar();

    const funcId = window._fichaFuncId;
    if (!funcId) { window.router.navigate('funcionarios'); return; }
    S.funcId = funcId;
    S.ano    = new Date().getFullYear();
    S.mes    = new Date().getMonth();
    S.feriados = new Set();

    // Parâmetros
    try {
        const ps = await getDoc(docEmpresa('configuracoes', 'empresa_base'));
        if (ps.exists()) {
            const pd = ps.data();
            S.limiteDiasFerias = pd.limiteDiasFerias || 22;
            const lista = feriadosPortugal(S.ano);
            const ativos = pd.feriadosAtivos || lista.map(f => f.nome);
            lista.forEach(f => { if (ativos.includes(f.nome)) S.feriados.add(f.data); });
            if (pd.feriadosLocais) {
                pd.feriadosLocais.split(',').forEach(s => {
                    const m = s.trim().match(/^(\d{2})\/(\d{2})$/);
                    if (m) S.feriados.add(`${m[2]}-${m[1]}`);
                });
            }
        }
    } catch(e) { console.warn('params:', e); }

    // Funcionário
    try {
        const fs = await getDoc(docEmpresa('funcionarios', funcId));
        if (!fs.exists()) { alert('Funcionário não encontrado.'); window.router.navigate('funcionarios'); return; }
        S.func = { id: fs.id, ...fs.data() };
    } catch(e) { alert('Erro: ' + e.message); return; }

    // Inicializar estado de filhos (lista dinâmica) com os já guardados
    definirContextoFuncionario('ficha', S.funcId, S.func.nome);
    inicializarFilhosState('ficha', S.func.filhos || []);

    // Preencher campos do horário de trabalho com os dados guardados
    const horario = S.func.horarioTrabalho || {};
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('ficha-hor-entrada', horario.entrada);
    setVal('ficha-hor-saida', horario.saida);
    setVal('ficha-hor-almoco-inicio', horario.almocoInicio);
    setVal('ficha-hor-almoco-fim', horario.almocoFim);
    window._colabRecalcularHorario('ficha');

    // Preencher campos editáveis de Dados Profissionais com os dados guardados
    setVal('ficha-prof-cargo', S.func.cargo);
    setVal('ficha-prof-departamento', S.func.departamento);
    setVal('ficha-prof-admissao', S.func.admissao);
    setVal('ficha-prof-tipo-contrato', S.func.tipoContrato || 'Sem termo');
    setVal('ficha-prof-fim-contrato', S.func.dataFimContrato || '');
    setVal('ficha-prof-motivo-cessacao', S.func.motivoCessacao || '');
    setVal('ficha-prof-salario', S.func.salarioBase);
    setVal('ficha-prof-subsidio-dia', S.func.subsidioRefeicaoDia ?? '');
    setVal('ficha-prof-subsidio-modo', S.func.subsidioRefeicaoModo || 'dinheiro');
    setVal('ficha-prof-cessacao', S.func.dataCessacao || '');
    setVal('ficha-prof-irs', S.func.categoriaIRS || 'solteiro');
    setVal('ficha-prof-taxa-irs', S.func.taxaIRS ?? '');
    document.getElementById('ficha-prof-qualificacao-wrap').innerHTML = renderSelectQualificacao('ficha-prof-qualificacao', S.func.qualificacao || '');
    const horarioInfoEl = document.getElementById('ficha-prof-horario-info');
    if (horarioInfoEl) horarioInfoEl.textContent = 'O horário de trabalho é editado na secção "Horário de Trabalho".';

    const f = S.func;
    S.direitoAno = calcularDireitoFerias(f.admissao, S.ano, S.limiteDiasFerias);

    // Header
    document.getElementById('ficha-titulo').textContent = f.nome || 'Colaborador';
    document.getElementById('ficha-sub').textContent =
        `NIF: ${f.nif||'—'}  ·  ${f.cargo||''}  ·  Admissão: ${f.admissao ? new Date(f.admissao+'T00:00:00').toLocaleDateString('pt-PT') : '—'}`;

    // Dados pessoais — preencher campos editáveis com os dados guardados
    const nFilhos = (f.filhos || []).length;
    const setValPess = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setValPess('ficha-pess-nome', f.nome);
    setValPess('ficha-pess-nif', f.nif);
    setValPess('ficha-pess-nascimento', f.nascimento);
    setValPess('ficha-pess-morada', f.morada);
    setValPess('ficha-pess-codigo-postal', f.codigoPostal);
    setValPess('ficha-pess-nacionalidade', f.nacionalidade);
    setValPess('ficha-pess-contacto', f.contacto);
    setValPess('ficha-pess-email', f.email);
    setValPess('ficha-pess-nib', f.nib);
    document.getElementById('ficha-pess-estado-civil-wrap').innerHTML = renderSelectEstadoCivil('ficha-pess-estado-civil', f.estadoCivil || '');
    const filhosInfoEl = document.getElementById('ficha-pess-filhos-info');
    if (filhosInfoEl) filhosInfoEl.textContent = `Nº de Filhos: ${nFilhos} — editado na secção "Filhos / Dependentes" abaixo.`;

    // Selector de ano
    const anoAdm = f.admissao ? new Date(f.admissao+'T00:00:00').getFullYear() : S.ano;
    const anoAtual = new Date().getFullYear();
    const sel = document.getElementById('ficha-sel-ano');
    for (let a = anoAdm; a <= anoAtual + 1; a++) {
        const o = document.createElement('option');
        o.value = a; o.textContent = a;
        if (a === S.ano) o.selected = true;
        sel.appendChild(o);
    }

    // Navegação meses
    document.getElementById('cal-prev').addEventListener('click', () => {
        if (S.mes === 0) { S.mes=11; S.ano--; } else S.mes--;
        _syncAno(); renderCal();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
        if (S.mes === 11) { S.mes=0; S.ano++; } else S.mes++;
        _syncAno(); renderCal();
    });

    renderCal();
}

function _syncAno() {
    S.direitoAno = calcularDireitoFerias(S.func?.admissao, S.ano, S.limiteDiasFerias);
    const sel = document.getElementById('ficha-sel-ano');
    if (sel) sel.value = S.ano;
}

// feriadosPortugal importado de ferias-utils.js
