// assets/js/modules/assiduidade.js
import { db } from '../app.js';
import {
    collection, getDocs, doc, getDoc, setDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { feriadosPortugal } from './ferias-utils.js';

// ─── Tipos de ausência ────────────────────────────────────────────────────────
// Cada ausência guardada no Firestore em "ausencias/{funcId}_{ano}" tem a forma:
// { tipo, dataInicio, dataFim, justificacaoPresenca?, dispensaAniversario? }
//
// TIPOS:
//   'falta_justificada'      – esteve ausente mas trouxe justificação (não conta para assiduidade; sem sub. refeição)
//   'falta_injustificada'    – ausência sem justificação (conta contra assiduidade; sem sub. refeição)
//   'baixa_medica'           – baixa médica certificada (conta contra assiduidade; sem sub. refeição)
//   'consulta_justificada'   – parte do dia, com justificação de presença (presente para assiduidade; COM sub. refeição)
//   'consulta_sem_justif'    – parte do dia, sem justificação (sem sub. refeição)
//   'aniversario'            – empresa dispensou no dia de aniversário (não é falta; sem sub. refeição)
//   'ferias'                 – usa diasFerias já existente, listado aqui para cálculo sub. refeição

const TIPOS_LABEL = {
    falta_justificada:    { label: 'Falta Justificada',         cor: '#f59e0b', emoji: '📋' },
    falta_injustificada:  { label: 'Falta Injustificada',       cor: '#ef4444', emoji: '❌' },
    baixa_medica:         { label: 'Baixa Médica',              cor: '#8b5cf6', emoji: '🏥' },
    consulta_justificada: { label: 'Consulta (com justif.)',     cor: '#3b82f6', emoji: '🩺' },
    consulta_sem_justif:  { label: 'Consulta (sem justif.)',     cor: '#f97316', emoji: '⚠️' },
    aniversario:          { label: 'Dia de Aniversário',        cor: '#ec4899', emoji: '🎂' },
};

// Regras de subsídio de refeição
function temSubsidioRefeicao(tipo) {
    return tipo === 'consulta_justificada';
    // tudo o resto: false
}

// Regras de assiduidade (false = desconta presença)
function contaComoFaltaAssiduidade(tipo) {
    return tipo === 'falta_injustificada' || tipo === 'baixa_medica' || tipo === 'falta_justificada';
}

// ─── Motivos legais de Falta Justificada (Código do Trabalho) ────────────────
// Art.º 249.º/250.º do CT — lista taxativa de motivos que justificam a ausência.
// Qualquer motivo fora desta lista é, por definição legal, considerado injustificado.
const MOTIVOS_FALTA_JUSTIFICADA = [
    { id: 'casamento',          dias: 15,  label: 'Casamento (até 15 dias seguidos)',
      base: 'Art.º 249.º, n.º 2, al. a) CT' },
    { id: 'falecimento',        dias: null, label: 'Falecimento de cônjuge, parente ou afim',
      base: 'Art.º 249.º, n.º 2, al. b) e Art.º 251.º CT' },
    { id: 'prova_ensino',       dias: null, label: 'Prestação de prova em estabelecimento de ensino',
      base: 'Art.º 249.º, n.º 2, al. c) e Art.º 91.º CT' },
    { id: 'facto_nao_imputavel',dias: null, label: 'Impossibilidade de prestar trabalho por facto não imputável (doença, acidente, PMA, obrigação legal)',
      base: 'Art.º 249.º, n.º 2, al. d) CT' },
    { id: 'assistencia_familia',dias: null, label: 'Assistência inadiável a filho, neto ou membro do agregado familiar',
      base: 'Art.º 249.º, n.º 2, al. e) e Art.os 49.º, 50.º e 252.º CT' },
    { id: 'acompanhamento_parto',dias: null, label: 'Acompanhamento de grávida deslocada para realização de parto',
      base: 'Art.º 249.º, n.º 2, al. f) CT' },
    { id: 'situacao_educativa', dias: null, label: 'Deslocação a estabelecimento de ensino por motivo educativo (até 4h/trimestre)',
      base: 'Art.º 249.º, n.º 2, al. g) CT' },
    { id: 'luto_gestacional',   dias: null, label: 'Luto gestacional',
      base: 'Art.º 249.º, n.º 2, al. h) e Art.º 38.º-A CT' },
    { id: 'representante_trab', dias: null, label: 'Trabalhador eleito para estrutura de representação coletiva',
      base: 'Art.º 249.º, n.º 2, al. i) e Art.º 409.º CT' },
    { id: 'candidato_publico',  dias: null, label: 'Candidato a cargo público (lei eleitoral)',
      base: 'Art.º 249.º, n.º 2, al. j) CT' },
    { id: 'autorizada_empregador', dias: null, label: 'Autorizada ou aprovada pelo empregador',
      base: 'Art.º 249.º, n.º 2, al. k) CT' },
    { id: 'outra_lei',          dias: null, label: 'Outra falta que por lei seja considerada justificada',
      base: 'Art.º 249.º, n.º 2, al. l) CT' },
];


let S = {
    funcId: null,
    func: null,
    ausencias: [],          // [{id, tipo, dataInicio, dataFim, ...}]
    anoMapa: new Date().getFullYear(),
    mesMapa: new Date().getMonth(),
    feriados: new Set(),
    subsidioRefeicao: 0,
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function sidebar(ativo) {
    const btn = (rota, label) => {
        const isAtivo = rota === ativo;
        return `<button onclick="window.router.navigate('${rota}')"
            style="display:block;width:100%;text-align:left;
                   background:${isAtivo ? '#3b82f6' : 'none'};
                   color:${isAtivo ? '#fff' : '#8a99ad'};
                   padding:10px;border:none;cursor:pointer;font-size:14px;
                   border-radius:6px;margin-bottom:4px;
                   font-weight:${isAtivo ? 'bold' : 'normal'};">${label}</button>`;
    };
    return `
    <aside style="width:260px;background:#1a233a;color:#fff;padding:20px;flex-shrink:0;">
        <div style="display:flex;align-items:center;margin-bottom:30px;">
            <div style="background:#3b82f6;padding:8px;border-radius:8px;margin-right:10px;">🏢</div>
            <div><h3 style="margin:0;font-size:16px;">Portal RH</h3><small style="color:#8a99ad;">Gestão de Vencimentos</small></div>
        </div>
        <nav>
            <p style="color:#4f5d73;font-size:11px;text-transform:uppercase;font-weight:bold;margin:0 0 8px;">Principal</p>
            ${btn('dashboard','📊 Dashboard')}
            <p style="color:#4f5d73;font-size:11px;text-transform:uppercase;font-weight:bold;margin:16px 0 8px;">Gestão</p>
            ${btn('funcionarios','👥 Colaboradores')}
            ${btn('criar-funcionario','➕ Novo Funcionário')}
            ${btn('assiduidade','📅 Assiduidade')}
            <p style="color:#4f5d73;font-size:11px;text-transform:uppercase;font-weight:bold;margin:16px 0 8px;">Configurações</p>
            ${btn('parametrizacao','⚙️ Parametrização')}
        </nav>
    </aside>`;
}

// ─── render() ─────────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:#f4f6f9;font-family:sans-serif;">
        ${sidebar('assiduidade')}

        <main style="flex:1;padding:28px;overflow-y:auto;">
            <header style="display:flex;align-items:center;gap:12px;margin-bottom:22px;">
                <div style="flex:1;">
                    <h2 style="margin:0;font-size:22px;color:#1a233a;">📅 Mapa de Assiduidade</h2>
                    <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Registo de faltas, baixas médicas e ausências. O colaborador é considerado presente por defeito.</p>
                </div>
            </header>

            <!-- Selector de colaborador -->
            <div style="background:#fff;padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);margin-bottom:18px;">
                <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;">
                    <div style="flex:1;min-width:200px;">
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:#475569;font-size:13px;">Colaborador</label>
                        <select id="sel-func" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;background:#fff;">
                            <option value="">— Selecione um colaborador —</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:#475569;font-size:13px;">Ano</label>
                        <select id="sel-ano-mapa" style="padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;background:#fff;">
                        </select>
                    </div>
                </div>
            </div>

            <!-- Painel principal (oculto até selecionar colaborador) -->
            <div id="painel-assiduidade" style="display:none;">

                <!-- KPIs assiduidade -->
                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px;" id="kpis-assiduidade"></div>

                <!-- Calendário + Registo de ausências -->
                <div style="display:grid;grid-template-columns:1fr 340px;gap:18px;align-items:start;">

                    <!-- Calendário mensal -->
                    <div style="background:#fff;padding:22px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                            <h4 style="margin:0;color:#1a233a;font-size:15px;">🗓️ Mapa Mensal</h4>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <button id="mapa-prev" style="background:#f1f5f9;border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:14px;">‹</button>
                                <span id="mapa-cal-label" style="font-weight:bold;font-size:13px;color:#1a233a;min-width:130px;text-align:center;"></span>
                                <button id="mapa-next" style="background:#f1f5f9;border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:14px;">›</button>
                            </div>
                        </div>
                        <div id="mapa-cal" style="user-select:none;"></div>
                        <!-- Legenda -->
                        <div style="display:flex;gap:10px;margin-top:14px;font-size:11px;color:#64748b;flex-wrap:wrap;">
                            <span><i style="display:inline-block;width:11px;height:11px;background:#dcfce7;border:1px solid #22c55e;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Presente</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:#fef3c7;border:1px solid #f59e0b;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Falta Justif.</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:#fee2e2;border:1px solid #ef4444;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Falta Injustif.</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:#ede9fe;border:1px solid #8b5cf6;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Baixa Médica</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:#dbeafe;border:1px solid #3b82f6;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Consulta</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:#fce7f3;border:1px solid #ec4899;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Aniversário</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:#bbf7d0;border:1px solid #22c55e;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Férias</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Fim semana / Feriado</span>
                        </div>
                    </div>

                    <!-- Painel direito: registar ausência + lista -->
                    <div style="display:flex;flex-direction:column;gap:16px;">

                        <!-- Formulário de registo de ausência -->
                        <div style="background:#fff;padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                            <h4 style="margin:0 0 14px;color:#1a233a;font-size:13px;border-bottom:2px solid #3b82f6;padding-bottom:7px;">➕ Registar Ausência</h4>
                            <div style="margin-bottom:12px;">
                                <label style="display:block;margin-bottom:5px;font-weight:500;color:#475569;font-size:12px;">Tipo de Ausência</label>
                                <select id="aus-tipo" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;background:#fff;">
                                    <option value="falta_justificada">📋 Falta Justificada</option>
                                    <option value="falta_injustificada">❌ Falta Injustificada</option>
                                    <option value="baixa_medica">🏥 Baixa Médica</option>
                                    <option value="consulta_justificada">🩺 Consulta (com justif. de presença)</option>
                                    <option value="consulta_sem_justif">⚠️ Consulta (sem justif.)</option>
                                    <option value="aniversario">🎂 Dia de Aniversário (dispensa empresa)</option>
                                </select>
                            </div>
                            <div id="aus-motivo-wrap" style="margin-bottom:12px;display:none;">
                                <label style="display:block;margin-bottom:5px;font-weight:500;color:#475569;font-size:12px;">Motivo Legal (Código do Trabalho)</label>
                                <select id="aus-motivo" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;background:#fff;">
                                    ${MOTIVOS_FALTA_JUSTIFICADA.map(m => `<option value="${m.id}">${m.label}</option>`).join('')}
                                    <option value="__fora_lista__">⚠️ Nenhum dos motivos acima (fora da lista legal)</option>
                                </select>
                                <small id="aus-motivo-base" style="display:block;margin-top:4px;color:#94a3b8;font-size:10.5px;"></small>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
                                <div>
                                    <label style="display:block;margin-bottom:5px;font-weight:500;color:#475569;font-size:12px;">Data Início</label>
                                    <input type="date" id="aus-inicio" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;box-sizing:border-box;">
                                </div>
                                <div>
                                    <label style="display:block;margin-bottom:5px;font-weight:500;color:#475569;font-size:12px;">Data Fim</label>
                                    <input type="date" id="aus-fim" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;box-sizing:border-box;">
                                </div>
                            </div>
                            <div id="aus-nota-wrap" style="margin-bottom:12px;display:none;">
                                <label style="display:block;margin-bottom:5px;font-weight:500;color:#475569;font-size:12px;">Notas / Observações</label>
                                <input type="text" id="aus-nota" placeholder="Opcional" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;box-sizing:border-box;">
                            </div>
                            <div id="aus-regra" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px;font-size:11px;color:#166534;margin-bottom:12px;"></div>
                            <button onclick="window._ausRegistar()"
                                style="width:100%;background:#3b82f6;color:#fff;border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">
                                💾 Guardar Ausência
                            </button>
                        </div>

                        <!-- Lista de ausências registadas -->
                        <div style="background:#fff;padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                            <h4 style="margin:0 0 14px;color:#1a233a;font-size:13px;border-bottom:2px solid #f59e0b;padding-bottom:7px;">📋 Ausências Registadas</h4>
                            <div id="lista-ausencias" style="max-height:260px;overflow-y:auto;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>`;
}

// ─── Calendário do mapa ───────────────────────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function getDiaEstado(ds) {
    // ds = "YYYY-MM-DD"
    const f = S.func;
    if (!f) return 'futuro';
    const admissao = f.admissao || '1900-01-01';
    if (ds < admissao) return 'antes_admissao';

    // Férias
    const diasFerias  = new Set(f.diasFerias  || []);
    if (diasFerias.has(ds)) return 'ferias';

    // Ausências – a mais severa prevalece
    const aus = S.ausencias.filter(a => a.dataInicio <= ds && ds <= a.dataFim);
    if (!aus.length) return 'presente';
    // Prioridade: baixa > injustificada > justificada > consulta > aniversario
    const prio = ['baixa_medica','falta_injustificada','falta_justificada','consulta_sem_justif','consulta_justificada','aniversario'];
    let melhor = aus.reduce((acc, a) => {
        const p = prio.indexOf(a.tipo);
        return p < prio.indexOf(acc.tipo) ? a : acc;
    }, aus[0]);
    return melhor.tipo;
}

function renderCal() {
    const cont  = document.getElementById('mapa-cal');
    const label = document.getElementById('mapa-cal-label');
    if (!cont || !label || !S.func) return;

    label.textContent = `${MESES[S.mesMapa]} ${S.anoMapa}`;
    const primeiroDia = new Date(S.anoMapa, S.mesMapa, 1).getDay();
    const diasNoMes   = new Date(S.anoMapa, S.mesMapa + 1, 0).getDate();
    const hoje = new Date().toISOString().slice(0,10);

    const estilos = {
        antes_admissao:     { bg:'#f8fafc', border:'1px solid #e2e8f0', color:'#cbd5e1' },
        futuro:             { bg:'#f8fafc', border:'1px solid #e2e8f0', color:'#94a3b8' },
        presente:           { bg:'#dcfce7', border:'1px solid #22c55e', color:'#14532d' },
        ferias:             { bg:'#bbf7d0', border:'2px solid #22c55e', color:'#065f46' },
        falta_justificada:  { bg:'#fef3c7', border:'2px solid #f59e0b', color:'#92400e' },
        falta_injustificada:{ bg:'#fee2e2', border:'2px solid #ef4444', color:'#991b1b' },
        baixa_medica:       { bg:'#ede9fe', border:'2px solid #8b5cf6', color:'#4c1d95' },
        consulta_justificada:{ bg:'#dbeafe', border:'2px solid #3b82f6', color:'#1e3a8a' },
        consulta_sem_justif:{ bg:'#ffedd5', border:'2px solid #f97316', color:'#7c2d12' },
        aniversario:        { bg:'#fce7f3', border:'2px solid #ec4899', color:'#831843' },
    };

    let h = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">`;
    DIAS_SEMANA.forEach(d => h += `<div style="text-align:center;font-size:10px;font-weight:bold;color:#94a3b8;padding:4px 0;">${d}</div>`);
    for (let i = 0; i < primeiroDia; i++) h += `<div></div>`;

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const ds  = `${S.anoMapa}-${String(S.mesMapa+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        const fk  = `${String(S.mesMapa+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        const dow = new Date(S.anoMapa, S.mesMapa, dia).getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isFeriado = S.feriados.has(fk);
        const isHoje    = ds === hoje;

        let est, title;
        if (isWeekend || isFeriado) {
            est = { bg:'#f1f5f9', border:'1px solid #e2e8f0', color:'#94a3b8' };
            title = isFeriado ? 'Feriado' : 'Fim de semana';
        } else {
            const estado = getDiaEstado(ds);
            est = estilos[estado] || estilos.presente;
            title = estado === 'presente' ? 'Presente' :
                    estado === 'ferias'   ? 'Férias'   :
                    TIPOS_LABEL[estado]?.label || estado;
        }

        const hojeStyle = isHoje ? 'outline:2px solid #3b82f6;outline-offset:1px;' : '';

        h += `<div title="${title}" style="text-align:center;padding:7px 2px;border-radius:5px;font-size:11px;
                   background:${est.bg};border:${est.border};color:${est.color};
                   font-weight:${isHoje?'bold':'normal'};${hojeStyle}">${dia}</div>`;
    }
    h += `</div>`;
    cont.innerHTML = h;
    renderKPIs();
}

// ─── KPIs ────────────────────────────────────────────────────────────────────
function renderKPIs() {
    const el = document.getElementById('kpis-assiduidade');
    if (!el || !S.func) return;

    const anoStr = String(S.anoMapa);
    const admissao = S.func.admissao || `${S.anoMapa}-01-01`;
    const hoje = new Date().toISOString().slice(0,10);
    const limiteStr = `${anoStr}-12-31` < hoje ? `${anoStr}-12-31` : hoje;

    let diasUteis = 0, diasPresente = 0, diasFaltaAss = 0, diasFerias = 0, diasSubsidio = 0;

    // iterar todos os dias do ano até hoje (ou fim do ano se passado)
    let cur = new Date(`${anoStr}-01-01T00:00:00`);
    const fim = new Date(limiteStr + 'T00:00:00');
    const admDate = new Date(admissao + 'T00:00:00');

    while (cur <= fim) {
        const ds  = cur.toISOString().slice(0,10);
        const fk  = ds.slice(5,7) + '-' + ds.slice(8,10);
        const dow = cur.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isFeriado = S.feriados.has(fk);

        if (!isWeekend && !isFeriado && cur >= admDate) {
            diasUteis++;
            const estado = getDiaEstado(ds);
            const isFer = (S.func.diasFerias || []).includes(ds);

            if (isFer) {
                diasFerias++;
                // sem sub refeição em férias
            } else if (contaComoFaltaAss(estado)) {
                diasFaltaAss++;
            } else {
                diasPresente++;
                // sub refeição: presente normal OU consulta com justif
                if (estado === 'presente' || estado === 'consulta_justificada') diasSubsidio++;
            }
        }
        cur.setDate(cur.getDate() + 1);
    }

    const txAssiduidade = diasUteis > 0 ? ((diasPresente / diasUteis) * 100).toFixed(1) : '—';
    const valorSubsidio = (diasSubsidio * S.subsidioRefeicao).toLocaleString('pt-PT', {style:'currency',currency:'EUR'});

    el.innerHTML = [
        ['#3b82f6', '📅', 'Dias Úteis', diasUteis, 'desde admissão'],
        ['#22c55e', '✅', 'Dias Presente', diasPresente, 'para assiduidade'],
        ['#ef4444', '❌', 'Faltas/Baixas', diasFaltaAss, 'contam contra assiduidade'],
        ['#f59e0b', `${txAssiduidade}%`, 'Taxa Assiduidade', '', ''],
        ['#10b981', '🍽️', 'Sub. Refeição', valorSubsidio, `${diasSubsidio} dias × ${S.subsidioRefeicao.toFixed(2)}€`],
    ].map(([cor, icon, lbl, val, sub]) => `
        <div style="background:#fff;padding:16px;border-radius:10px;border-top:3px solid ${cor};
                    box-shadow:0 2px 4px rgba(0,0,0,0.04);text-align:center;">
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${lbl}</div>
            <div style="font-size:${lbl==='Taxa Assiduidade'?'20':'26'}px;font-weight:bold;color:#1a233a;">${lbl==='Taxa Assiduidade'?icon:val||icon}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${sub}</div>
        </div>`).join('');
}

function contaComoFaltaAss(estado) {
    return estado === 'falta_injustificada' || estado === 'baixa_medica' || estado === 'falta_justificada';
}

// ─── Lista de ausências ───────────────────────────────────────────────────────
function renderLista() {
    const el = document.getElementById('lista-ausencias');
    if (!el) return;
    const anoStr = String(S.anoMapa);
    const aus = S.ausencias.filter(a => a.dataInicio.startsWith(anoStr) || a.dataFim.startsWith(anoStr));
    if (!aus.length) {
        el.innerHTML = `<p style="color:#94a3b8;font-style:italic;font-size:12px;margin:0;">Nenhuma ausência registada em ${anoStr}.</p>`;
        return;
    }
    el.innerHTML = aus.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio)).map(a => {
        const t = TIPOS_LABEL[a.tipo] || { label: a.tipo, cor:'#94a3b8', emoji:'?' };
        const sub = temSubsidioRefeicao(a.tipo) ? '🍽️ Sub. Refeição' : '—';
        const motivoHtml = a.motivoLabel
            ? `<br>⚖️ ${a.motivoLabel}${a.motivoBase ? ` <span style="color:#94a3b8;">(${a.motivoBase})</span>` : ''}`
            : '';
        return `
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-size:12px;font-weight:bold;color:${t.cor};">${t.emoji} ${t.label}</span>
                <button onclick="window._ausEliminar('${a.id}')"
                    style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;padding:0 2px;" title="Eliminar">✕</button>
            </div>
            <div style="font-size:11px;color:#475569;">
                📅 ${formatDate(a.dataInicio)} → ${formatDate(a.dataFim)}
                ${motivoHtml}
                ${a.nota ? `<br>📝 ${a.nota}` : ''}
                <br><span style="color:#64748b;">Sub. refeição: ${sub}</span>
            </div>
        </div>`;
    }).join('');
}

function formatDate(ds) {
    if (!ds) return '—';
    return new Date(ds + 'T00:00:00').toLocaleDateString('pt-PT', {day:'2-digit',month:'2-digit',year:'numeric'});
}

// ─── Regra exibida no formulário ──────────────────────────────────────────────
function atualizarRegra() {
    const tipo        = document.getElementById('aus-tipo')?.value;
    const el          = document.getElementById('aus-regra');
    const nota        = document.getElementById('aus-nota-wrap');
    const motivoWrap  = document.getElementById('aus-motivo-wrap');
    const motivoBase  = document.getElementById('aus-motivo-base');
    const motivoSel   = document.getElementById('aus-motivo');
    if (!el) return;

    // Mostrar/ocultar selector de motivo legal apenas para Falta Justificada
    if (motivoWrap) motivoWrap.style.display = (tipo === 'falta_justificada') ? 'block' : 'none';

    const regras = {
        falta_justificada:    { cor:'#fef3c7', txt:'#92400e', borda:'#f59e0b', msg:'📋 Falta justificada nos termos do art.º 249.º do Código do Trabalho. Assiduidade: <b>desconta</b>. Subsídio Refeição: <b>não tem direito</b>.' },
        falta_injustificada:  { cor:'#fee2e2', txt:'#991b1b', borda:'#ef4444', msg:'❌ Qualquer falta não prevista no art.º 249.º, n.º 2 do CT é considerada injustificada. Assiduidade: <b>desconta</b>. Subsídio Refeição: <b>não tem direito</b>.' },
        baixa_medica:         { cor:'#ede9fe', txt:'#4c1d95', borda:'#8b5cf6', msg:'🏥 Assiduidade: <b>desconta</b>. Subsídio Refeição: <b>não tem direito</b>.' },
        consulta_justificada: { cor:'#dbeafe', txt:'#1e3a8a', borda:'#3b82f6', msg:'🩺 Assiduidade: <b>presente</b> (parte do dia). Subsídio Refeição: <b>tem direito</b> (com justificação).' },
        consulta_sem_justif:  { cor:'#ffedd5', txt:'#7c2d12', borda:'#f97316', msg:'⚠️ Assiduidade: <b>presente</b>. Subsídio Refeição: <b>não tem direito</b> (sem justificação).' },
        aniversario:          { cor:'#fce7f3', txt:'#831843', borda:'#ec4899', msg:'🎂 <b>Não é falta</b>. Assiduidade: <b>presente</b>. Subsídio Refeição: <b>não tem direito</b>.' },
    };

    let r = regras[tipo];

    // Se for falta justificada e o motivo escolhido estiver fora da lista legal, reclassifica visualmente como injustificada
    if (tipo === 'falta_justificada' && motivoSel) {
        const motivoId = motivoSel.value;
        if (motivoId === '__fora_lista__') {
            r = { cor:'#fee2e2', txt:'#991b1b', borda:'#ef4444',
                  msg:'⚠️ Motivo fora da lista taxativa do art.º 249.º, n.º 2 do CT — a falta será registada como <b>Falta Injustificada</b>. Assiduidade: <b>desconta</b>. Subsídio Refeição: <b>não tem direito</b>.' };
            if (motivoBase) motivoBase.textContent = '';
        } else {
            const m = MOTIVOS_FALTA_JUSTIFICADA.find(x => x.id === motivoId);
            if (motivoBase) motivoBase.textContent = m ? m.base : '';
        }
    }

    if (r) {
        el.style.cssText = `background:${r.cor};border:1px solid ${r.borda};border-radius:6px;padding:10px;font-size:11px;color:${r.txt};margin-bottom:12px;`;
        el.innerHTML = r.msg;
    }
    if (nota) nota.style.display = 'block';
}


// ─── Registar ausência ────────────────────────────────────────────────────────
window._ausRegistar = async function() {
    let tipo     = document.getElementById('aus-tipo').value;
    const inicio = document.getElementById('aus-inicio').value;
    const fim    = document.getElementById('aus-fim').value;
    const nota   = document.getElementById('aus-nota').value;
    const motivoSel = document.getElementById('aus-motivo');

    if (!inicio || !fim) { alert('Por favor preencha as datas de início e fim.'); return; }
    if (fim < inicio)    { alert('A data de fim não pode ser anterior à data de início.'); return; }

    let motivoId = null, motivoLabel = null, motivoBase = null;

    if (tipo === 'falta_justificada') {
        motivoId = motivoSel ? motivoSel.value : null;

        if (motivoId === '__fora_lista__') {
            // Motivo fora da lista taxativa do art.º 249.º, n.º 2 CT → reclassifica como injustificada
            tipo = 'falta_injustificada';
            motivoId = null;
        } else {
            const m = MOTIVOS_FALTA_JUSTIFICADA.find(x => x.id === motivoId);
            if (m) {
                motivoLabel = m.label;
                motivoBase  = m.base;

                // Validação do limite de 15 dias seguidos para falta por casamento
                if (m.id === 'casamento') {
                    const dIni = new Date(inicio + 'T00:00:00');
                    const dFim = new Date(fim + 'T00:00:00');
                    const numDias = Math.round((dFim - dIni) / 86400000) + 1;
                    if (numDias > 15) {
                        alert('A falta por motivo de casamento é justificada apenas até 15 dias seguidos (art.º 249.º, n.º 2, al. a) CT). Por favor ajuste o período.');
                        return;
                    }
                }
            }
        }
    }

    const id = `${S.funcId}_${Date.now()}`;
    const nova = { id, tipo, dataInicio: inicio, dataFim: fim, nota, motivoId, motivoLabel, motivoBase };
    S.ausencias.push(nova);

    await guardarAusencias();
    renderCal();
    renderLista();

    // limpar form
    document.getElementById('aus-inicio').value = '';
    document.getElementById('aus-fim').value = '';
    document.getElementById('aus-nota').value = '';
};


window._ausEliminar = async function(id) {
    if (!confirm('Eliminar este registo de ausência?')) return;
    S.ausencias = S.ausencias.filter(a => a.id !== id);
    await guardarAusencias();
    renderCal();
    renderLista();
};

async function guardarAusencias() {
    try {
        await setDoc(doc(db, 'ausencias', S.funcId), { ausencias: S.ausencias });
    } catch(e) { alert('Erro ao guardar: ' + e.message); }
}

// ─── Carregar colaborador ─────────────────────────────────────────────────────
async function carregarFunc(funcId) {
    S.funcId = funcId;

    // Dados do colaborador
    const fs = await getDoc(doc(db, 'funcionarios', funcId));
    if (!fs.exists()) return;
    S.func = { id: fs.id, ...fs.data() };

    // Ausências guardadas
    try {
        const as = await getDoc(doc(db, 'ausencias', funcId));
        S.ausencias = as.exists() ? (as.data().ausencias || []) : [];
    } catch(e) { S.ausencias = []; }

    // Ano selector
    const anoAdm = S.func.admissao ? new Date(S.func.admissao+'T00:00:00').getFullYear() : S.anoMapa;
    const anoAtual = new Date().getFullYear();
    const selAno = document.getElementById('sel-ano-mapa');
    selAno.innerHTML = '';
    for (let a = anoAdm; a <= anoAtual; a++) {
        const o = document.createElement('option');
        o.value = a; o.textContent = a;
        if (a === S.anoMapa) o.selected = true;
        selAno.appendChild(o);
    }

    document.getElementById('painel-assiduidade').style.display = 'block';
    renderCal();
    renderLista();
    atualizarRegra();
}

// ─── init() ───────────────────────────────────────────────────────────────────
export async function init() {
    S.anoMapa = new Date().getFullYear();
    S.mesMapa = new Date().getMonth();
    S.feriados = new Set();
    S.subsidioRefeicao = 0;

    // Parâmetros
    try {
        const ps = await getDoc(doc(db, 'configuracoes', 'empresa_base'));
        if (ps.exists()) {
            const pd = ps.data();
            S.subsidioRefeicao = pd.subsidioRefeicao || 0;
            const lista  = feriadosPortugal(S.anoMapa);
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

    // Lista de colaboradores
    try {
        const snap = await getDocs(collection(db, 'funcionarios'));
        const sel  = document.getElementById('sel-func');
        snap.forEach(d => {
            const o = document.createElement('option');
            o.value = d.id;
            o.textContent = d.data().nome || d.id;
            sel.appendChild(o);
        });

        sel.addEventListener('change', () => {
            if (sel.value) carregarFunc(sel.value);
            else document.getElementById('painel-assiduidade').style.display = 'none';
        });
    } catch(e) { console.error(e); }

    // Navegação meses
    document.getElementById('mapa-prev').addEventListener('click', () => {
        if (S.mesMapa === 0) { S.mesMapa = 11; S.anoMapa--; } else S.mesMapa--;
        document.getElementById('sel-ano-mapa').value = S.anoMapa;
        renderCal();
    });
    document.getElementById('mapa-next').addEventListener('click', () => {
        if (S.mesMapa === 11) { S.mesMapa = 0; S.anoMapa++; } else S.mesMapa++;
        document.getElementById('sel-ano-mapa').value = S.anoMapa;
        renderCal();
    });

    // Mudança de ano
    document.getElementById('sel-ano-mapa').addEventListener('change', e => {
        S.anoMapa = parseInt(e.target.value);
        renderCal();
    });

    // Tipo de ausência → actualiza regra
    document.getElementById('aus-tipo').addEventListener('change', atualizarRegra);

    // Motivo legal (falta justificada) → actualiza regra/base legal exibida
    const motivoSel = document.getElementById('aus-motivo');
    if (motivoSel) motivoSel.addEventListener('change', atualizarRegra);

    // Data início → preenche data fim automaticamente
    document.getElementById('aus-inicio').addEventListener('change', e => {
        const fim = document.getElementById('aus-fim');
        if (!fim.value) fim.value = e.target.value;
    });
}
