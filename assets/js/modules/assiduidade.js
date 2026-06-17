// assets/js/modules/assiduidade.js
import { db } from '../app.js';
import {
    collection, getDocs, doc, getDoc, setDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { feriadosPortugal } from './ferias-utils.js';

// ─── Tipos de ausência ────────────────────────────────────────────────────────
// Cada ausência guardada no Firestore em "ausencias/{funcId}" tem a forma:
// { id, tipo, dataInicio, dataFim, horaInicio?, horaFim?, nota }
//
// A lista de tipos segue a tabela legal portuguesa de faltas/ausências.
// Cada tipo define:
//   label        – nome apresentado
//   emoji/cor    – identificação visual
//   grupo        – 'justificada' | 'injustificada' (agrupamento legal)
//   baseLegal    – referência ao artigo / lei
//   unidade      – 'dia' (regista datas) ou 'hora' (regista data+hora)
//   limite       – { valor, periodo } quando a lei define um máximo (null = sem limite definido / "dias necessários")
//   contaFalta   – true = desconta para efeitos de assiduidade
//   subsidio     – true = mantém direito a subsídio de refeição

const TIPOS_LABEL = {
    casamento: {
        label: 'Casamento', emoji: '💍', cor: 'var(--rh-warning)', grupo: 'justificada',
        baseLegal: 'Art. 249.º', unidade: 'dia',
        limite: { valor: 15, periodo: 'consecutivos', texto: '15 dias consecutivos' },
        contaFalta: false, subsidio: false,
    },
    falecimento_1grau: {
        label: 'Falecimento – filho/enteado/genro/nora', emoji: '🖤', cor: 'var(--rh-text-muted)', grupo: 'justificada',
        baseLegal: 'Lei n.º 1/2022', unidade: 'dia',
        limite: { valor: 20, periodo: 'consecutivos', texto: '20 dias consecutivos' },
        contaFalta: false, subsidio: false,
    },
    falecimento_conjuge_pais: {
        label: 'Falecimento – cônjuge/unido de facto/pais/sogros', emoji: '🖤', cor: 'var(--rh-text-muted)', grupo: 'justificada',
        baseLegal: 'Art. 251.º', unidade: 'dia',
        limite: { valor: 5, periodo: 'consecutivos', texto: '5 dias consecutivos' },
        contaFalta: false, subsidio: false,
    },
    falecimento_2grau: {
        label: 'Falecimento – irmãos/cunhados/avós/netos', emoji: '🖤', cor: 'var(--rh-text-subtle)', grupo: 'justificada',
        baseLegal: 'Art. 251.º', unidade: 'dia',
        limite: { valor: 2, periodo: 'consecutivos', texto: '2 dias consecutivos' },
        contaFalta: false, subsidio: false,
    },
    doenca_trabalhador: {
        label: 'Doença do Trabalhador', emoji: '🏥', cor: '#8b5cf6', grupo: 'justificada',
        baseLegal: 'Art. 249.º', unidade: 'dia',
        limite: null,
        limiteTexto: 'Durante a incapacidade (com atestado)',
        contaFalta: true, subsidio: false,
    },
    assistencia_filho_menor12: {
        label: 'Assistência a Filho < 12 anos', emoji: '👶', cor: 'var(--rh-primary)', grupo: 'justificada',
        baseLegal: 'Art. 252.º', unidade: 'dia',
        limite: { valor: 30, periodo: 'ano', texto: '30 dias/ano + 1 por filho adicional' },
        contaFalta: false, subsidio: false,
    },
    assistencia_filho_maior12: {
        label: 'Assistência a Filho ≥ 12 anos', emoji: '🧒', cor: 'var(--rh-primary-light)', grupo: 'justificada',
        baseLegal: 'Art. 252.º', unidade: 'dia',
        limite: { valor: 15, periodo: 'ano', texto: '15 dias/ano + 1 por filho adicional' },
        contaFalta: false, subsidio: false,
    },
    assistencia_familiar: {
        label: 'Assistência a Cônjuge/Pais/Sogros/Avós/Irmãos', emoji: '🤝', cor: 'var(--rh-secondary-light)', grupo: 'justificada',
        baseLegal: 'Art. 252.º', unidade: 'dia',
        limite: { valor: 15, periodo: 'ano', texto: '15 dias/ano' },
        contaFalta: false, subsidio: false,
    },
    assistencia_neto: {
        label: 'Assistência a Neto Recém-nascido (filho de adolescente)', emoji: '👵', cor: 'var(--rh-info)', grupo: 'justificada',
        baseLegal: 'Art. 252.º-A', unidade: 'dia',
        limite: { valor: 30, periodo: 'consecutivos', texto: '30 dias consecutivos' },
        contaFalta: false, subsidio: false,
    },
    luto_gestacional: {
        label: 'Luto Gestacional', emoji: '🕊️', cor: '#a78bfa', grupo: 'justificada',
        baseLegal: 'Art. 249.º', unidade: 'dia',
        limite: { valor: 3, periodo: 'consecutivos', texto: '3 dias consecutivos' },
        contaFalta: false, subsidio: false,
    },
    endometriose: {
        label: 'Endometriose / Adenomiose', emoji: '🌸', cor: '#ec4899', grupo: 'justificada',
        baseLegal: 'Lei n.º 32/2025', unidade: 'dia',
        limite: { valor: 3, periodo: 'mes', texto: 'Até 3 dias/mês' },
        contaFalta: false, subsidio: false,
    },
    provas_estudante: {
        label: 'Provas/Exames (Trabalhador-Estudante)', emoji: '🎓', cor: 'var(--rh-success)', grupo: 'justificada',
        baseLegal: 'Art. 91.º', unidade: 'dia',
        limite: null,
        limiteTexto: 'Dias necessários',
        contaFalta: false, subsidio: false,
    },
    deslocacao_escola: {
        label: 'Deslocação à Escola (responsável por menor)', emoji: '🏫', cor: 'var(--rh-secondary)', grupo: 'justificada',
        baseLegal: 'Art. 249.º', unidade: 'hora',
        limite: { valor: 4, periodo: 'trimestre', texto: '4 horas por trimestre' },
        contaFalta: false, subsidio: false,
    },
    obrigacao_legal: {
        label: 'Obrigação Legal (tribunal, autoridade)', emoji: '⚖️', cor: 'var(--rh-text-subtle)', grupo: 'justificada',
        baseLegal: 'Art. 249.º', unidade: 'dia',
        limite: null,
        limiteTexto: 'Dias necessários',
        contaFalta: false, subsidio: false,
    },
    atividade_sindical: {
        label: 'Atividade Sindical', emoji: '🚩', cor: 'var(--rh-danger-dark)', grupo: 'justificada',
        baseLegal: 'Art. 410.º', unidade: 'dia',
        limite: null,
        limiteTexto: 'Dias necessários',
        contaFalta: false, subsidio: false,
    },
    campanha_eleitoral: {
        label: 'Campanha Eleitoral (candidatos)', emoji: '🗳️', cor: '#7c3aed', grupo: 'justificada',
        baseLegal: 'Lei Eleitoral', unidade: 'dia',
        limite: null,
        limiteTexto: 'Dias necessários',
        contaFalta: false, subsidio: false,
    },
    autorizacao_empregador: {
        label: 'Autorização do Empregador', emoji: '✅', cor: 'var(--rh-secondary)', grupo: 'justificada',
        baseLegal: 'Art. 249.º', unidade: 'dia',
        limite: null,
        limiteTexto: 'Conforme acordo',
        contaFalta: false, subsidio: false,
    },
    falta_injustificada: {
        label: 'Falta Injustificada', emoji: '❌', cor: 'var(--rh-danger)', grupo: 'injustificada',
        baseLegal: 'Art. 248.º', unidade: 'dia',
        limite: { valor: 0, periodo: null, texto: '0 dias' },
        limiteTexto: '0 dias (pode levar a processo disciplinar)',
        contaFalta: true, subsidio: false,
    },
    // ─── Tipos operacionais adicionais (fora da tabela legal, mantidos do sistema) ───
    consulta_justificada: {
        label: 'Consulta (com justif. de presença)', emoji: '🩺', cor: 'var(--rh-primary)', grupo: 'justificada',
        baseLegal: '—', unidade: 'hora',
        limite: null, limiteTexto: 'Conforme necessidade',
        contaFalta: false, subsidio: true,
    },
    consulta_sem_justif: {
        label: 'Consulta (sem justif.)', emoji: '⚠️', cor: '#f97316', grupo: 'injustificada',
        baseLegal: '—', unidade: 'hora',
        limite: null, limiteTexto: 'Conforme necessidade',
        contaFalta: false, subsidio: false,
    },
    aniversario: {
        label: 'Dia de Aniversário', emoji: '🎂', cor: '#ec4899', grupo: 'justificada',
        baseLegal: '—', unidade: 'dia',
        limite: { valor: 1, periodo: 'ano', texto: '1 dia/ano' },
        contaFalta: false, subsidio: false,
    },
};

// Ordem de exibição no select (agrupada)
const GRUPOS_SELECT = [
    { titulo: 'Falta Justificada — Motivos Legais', tipos: [
        'casamento','falecimento_1grau','falecimento_conjuge_pais','falecimento_2grau',
        'doenca_trabalhador','assistencia_filho_menor12','assistencia_filho_maior12',
        'assistencia_familiar','assistencia_neto','luto_gestacional','endometriose',
        'provas_estudante','deslocacao_escola','obrigacao_legal','atividade_sindical',
        'campanha_eleitoral','autorizacao_empregador',
    ]},
    { titulo: 'Outras Ausências', tipos: [
        'consulta_justificada','consulta_sem_justif','aniversario',
    ]},
    { titulo: 'Falta Injustificada', tipos: [
        'falta_injustificada',
    ]},
];

// Regras de subsídio de refeição
// Para tipos de "dia inteiro" o subsídio é definido estaticamente (def.subsidio).
// Para tipos parciais (unidade 'hora'), o direito depende de quantas horas o
// colaborador efetivamente trabalhou nesse dia (horário previsto − horas de ausência),
// comparado com o mínimo definido na parametrização (S.horasMinSubsidio).
function temSubsidioRefeicao(tipo) {
    return !!TIPOS_LABEL[tipo]?.subsidio;
}

// Tipos que registam hora além da data
function usaHora(tipo) {
    return TIPOS_LABEL[tipo]?.unidade === 'hora';
}

// Devolve as horas previstas de trabalho nesse dia, segundo o horário do colaborador
function horasPrevistasNoDia(func) {
    const h = func?.horarioTrabalho;
    if (!h || !h.totalHoras) return 0;
    return h.totalHoras;
}

// Soma as horas de ausência de tipo 'hora' que incidem sobre um dia específico
function horasAusenciaNoDia(ds) {
    let total = 0;
    S.ausencias.forEach(a => {
        if (!usaHora(a.tipo)) return;
        if (a.dataInicio <= ds && ds <= a.dataFim) {
            total += contarUnidades(a, 'hora');
        }
    });
    return total;
}

// Decide se um dia com falta parcial (tipo 'hora') mantém direito a subsídio de refeição,
// comparando as horas efetivamente trabalhadas nesse dia com o mínimo exigido pela empresa.
// Devolve { elegivel, horasTrabalhadas, horasPrevistas, horasAusencia, motivo }
function avaliarSubsidioFaltaParcial(ds, func) {
    const horasPrevistas  = horasPrevistasNoDia(func);
    const horasAusencia   = horasAusenciaNoDia(ds);
    const horasTrabalhadas = Math.max(horasPrevistas - horasAusencia, 0);

    if (!horasPrevistas) {
        // sem horário definido: não é possível avaliar — assume-se a regra estática do tipo
        return { elegivel: null, horasTrabalhadas: null, horasPrevistas: 0, horasAusencia, motivo: 'sem_horario' };
    }
    const elegivel = horasTrabalhadas >= (S.horasMinSubsidio || 0);
    return { elegivel, horasTrabalhadas, horasPrevistas, horasAusencia, motivo: 'avaliado' };
}

// ─── Cálculo de uso acumulado para validação de limites ───────────────────────
// Devolve o total já utilizado (dias ou horas) pelo colaborador para um tipo,
// dentro do período relevante (ano civil, mês, trimestre) relativo à data de início indicada.
function calcularUsoAcumulado(tipo, dataInicioNova, excluirId) {
    const def = TIPOS_LABEL[tipo];
    if (!def || !def.limite) return { usado: 0, periodo: null };

    const d = new Date(dataInicioNova + 'T00:00:00');
    let chaveInicio, chaveFim;

    if (def.limite.periodo === 'ano') {
        chaveInicio = `${d.getFullYear()}-01-01`;
        chaveFim    = `${d.getFullYear()}-12-31`;
    } else if (def.limite.periodo === 'mes') {
        const y = d.getFullYear(), m = d.getMonth();
        chaveInicio = `${y}-${String(m+1).padStart(2,'0')}-01`;
        chaveFim    = new Date(y, m+1, 0).toISOString().slice(0,10);
    } else if (def.limite.periodo === 'trimestre') {
        const y = d.getFullYear(), q = Math.floor(d.getMonth()/3);
        chaveInicio = `${y}-${String(q*3+1).padStart(2,'0')}-01`;
        chaveFim    = new Date(y, q*3+3, 0).toISOString().slice(0,10);
    } else {
        // 'consecutivos' ou sem período definido: o limite aplica-se por registo isolado
        return { usado: 0, periodo: null };
    }

    let usado = 0;
    S.ausencias.forEach(a => {
        if (a.tipo !== tipo) return;
        if (excluirId && a.id === excluirId) return;
        if (a.dataInicio > chaveFim || a.dataFim < chaveInicio) return; // sem overlap com o período
        usado += contarUnidades(a, def.unidade);
    });
    return { usado, periodo: { inicio: chaveInicio, fim: chaveFim } };
}

// Conta dias (inclusive) ou horas de um registo de ausência
function contarUnidades(a, unidade) {
    if (unidade === 'hora') {
        if (a.horaInicio && a.horaFim) {
            const [h1,m1] = a.horaInicio.split(':').map(Number);
            const [h2,m2] = a.horaFim.split(':').map(Number);
            const horas = ((h2*60+m2) - (h1*60+m1)) / 60;
            return horas > 0 ? horas : 0;
        }
        return 0;
    }
    // dias inclusive entre dataInicio e dataFim
    const di = new Date(a.dataInicio + 'T00:00:00');
    const df = new Date(a.dataFim + 'T00:00:00');
    const dias = Math.round((df - di) / 86400000) + 1;
    return dias > 0 ? dias : 0;
}

// ─── Estado ───────────────────────────────────────────────────────────────────
let S = {
    funcId: null,
    func: null,
    ausencias: [],          // [{id, tipo, dataInicio, dataFim, ...}]
    anoMapa: new Date().getFullYear(),
    mesMapa: new Date().getMonth(),
    feriados: new Set(),
    subsidioRefeicao: 0,
    horasMinSubsidio: 0,    // mínimo de horas/dia para manter direito ao subsídio em faltas parciais
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function sidebar(ativo) {
    const btn = (rota, label) => {
        const isAtivo = rota === ativo;
        return `<button onclick="window.router.navigate('${rota}')"
            style="display:block;width:100%;text-align:left;
                   background:${isAtivo ? 'var(--rh-primary)' : 'none'};
                   color:${isAtivo ? 'var(--rh-bg-card)' : 'var(--rh-text-subtle)'};
                   padding:10px;border:none;cursor:pointer;font-size:14px;
                   border-radius:6px;margin-bottom:4px;
                   font-weight:${isAtivo ? 'bold' : 'normal'};">${label}</button>`;
    };
    return `
    <aside style="width:260px;background:var(--rh-primary);color:var(--rh-bg-card);padding:20px;flex-shrink:0;">
        <div style="display:flex;align-items:center;margin-bottom:30px;">
            <div style="background:var(--rh-primary-light);padding:8px;border-radius:8px;margin-right:10px;">🏢</div>
            <div><h3 style="margin:0;font-size:16px;">Portal RH</h3><small style="color:var(--rh-text-subtle);">Gestão de Vencimentos</small></div>
        </div>
        <nav>
            <p style="color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;font-weight:bold;margin:0 0 8px;">Principal</p>
            ${btn('dashboard','📊 Dashboard')}
            <p style="color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;font-weight:bold;margin:16px 0 8px;">Gestão</p>
            ${btn('funcionarios','👥 Colaboradores')}
            ${btn('criar-funcionario','➕ Novo Funcionário')}
            ${btn('assiduidade','📅 Assiduidade')}
            <p style="color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;font-weight:bold;margin:16px 0 8px;">Configurações</p>
            ${btn('parametrizacao','⚙️ Parametrização')}
        </nav>
    </aside>`;
}

// ─── render() ─────────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${sidebar('assiduidade')}

        <main style="flex:1;padding:28px;overflow-y:auto;">
            <header style="display:flex;align-items:center;gap:12px;margin-bottom:22px;">
                <div style="flex:1;">
                    <h2 style="margin:0;font-size:22px;color:var(--rh-primary);">📅 Mapa de Assiduidade</h2>
                    <p style="margin:4px 0 0;font-size:13px;color:var(--rh-text-muted);">Registo de faltas, baixas médicas e ausências. O colaborador é considerado presente por defeito.</p>
                </div>
            </header>

            <!-- Selector de colaborador -->
            <div style="background:var(--rh-bg-card);padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);margin-bottom:18px;">
                <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;">
                    <div style="flex:1;min-width:200px;">
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:var(--rh-text-muted);font-size:13px;">Colaborador</label>
                        <select id="sel-func" style="width:100%;padding:10px;border:1px solid var(--rh-border);border-radius:6px;font-size:14px;background:var(--rh-bg-card);">
                            <option value="">— Selecione um colaborador —</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:var(--rh-text-muted);font-size:13px;">Ano</label>
                        <select id="sel-ano-mapa" style="padding:10px;border:1px solid var(--rh-border);border-radius:6px;font-size:14px;background:var(--rh-bg-card);">
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
                    <div style="background:var(--rh-bg-card);padding:22px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                            <h4 style="margin:0;color:var(--rh-primary);font-size:15px;">🗓️ Mapa Mensal</h4>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <button id="mapa-prev" style="background:var(--rh-bg-muted);border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:14px;">‹</button>
                                <span id="mapa-cal-label" style="font-weight:bold;font-size:13px;color:var(--rh-primary);min-width:130px;text-align:center;"></span>
                                <button id="mapa-next" style="background:var(--rh-bg-muted);border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:14px;">›</button>
                            </div>
                        </div>
                        <div id="mapa-cal" style="user-select:none;"></div>
                        <!-- Legenda -->
                        <div style="display:flex;gap:10px;margin-top:14px;font-size:11px;color:var(--rh-text-muted);flex-wrap:wrap;">
                            <span><i style="display:inline-block;width:11px;height:11px;background:var(--rh-success-bg);border:1px solid var(--rh-success);border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Presente</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:var(--rh-success-bg);border:1px solid var(--rh-success);border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Férias</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:var(--rh-danger-bg);border:1px solid var(--rh-danger);border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Falta Injustificada</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:var(--rh-info-bg);border:1px solid var(--rh-primary);border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Falta Justificada (legal)</span>
                            <span><i style="display:inline-block;width:11px;height:11px;background:var(--rh-bg-muted);border:1px solid var(--rh-border);border-radius:2px;vertical-align:middle;margin-right:3px;"></i>Fim semana / Feriado</span>
                        </div>
                        <p style="font-size:10px;color:var(--rh-text-subtle);margin:8px 0 0;">💡 Passe o cursor sobre um dia para ver o motivo exato da ausência.</p>
                    </div>

                    <!-- Painel direito: registar ausência + lista -->
                    <div style="display:flex;flex-direction:column;gap:16px;">

                        <!-- Formulário de registo de ausência -->
                        <div style="background:var(--rh-bg-card);padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                            <h4 style="margin:0 0 14px;color:var(--rh-primary);font-size:13px;border-bottom:2px solid var(--rh-primary);padding-bottom:7px;">➕ Registar Ausência</h4>
                            <div style="margin-bottom:12px;">
                                <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Tipo de Ausência</label>
                                <select id="aus-tipo" style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;background:var(--rh-bg-card);">
                                    ${GRUPOS_SELECT.map(g => `
                                        <optgroup label="${g.titulo}">
                                            ${g.tipos.map(t => `<option value="${t}">${TIPOS_LABEL[t].emoji} ${TIPOS_LABEL[t].label}</option>`).join('')}
                                        </optgroup>`).join('')}
                                </select>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">
                                <div>
                                    <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Data Início</label>
                                    <input type="date" id="aus-inicio" style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                                </div>
                                <div>
                                    <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Data Fim</label>
                                    <input type="date" id="aus-fim" style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                                </div>
                            </div>
                            <div id="aus-hora-wrap" style="display:none;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
                                <div>
                                    <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Hora Início</label>
                                    <input type="time" id="aus-hora-inicio" style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                                </div>
                                <div>
                                    <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Hora Fim</label>
                                    <input type="time" id="aus-hora-fim" style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                                </div>
                            </div>
                            <div id="aus-nota-wrap" style="margin-bottom:12px;">
                                <label style="display:block;margin-bottom:5px;font-weight:500;color:var(--rh-text-muted);font-size:12px;">Notas / Observações</label>
                                <input type="text" id="aus-nota" placeholder="Opcional" style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                            </div>
                            <div id="aus-regra" style="background:var(--rh-success-bg);border:1px solid var(--rh-success-bg);border-radius:6px;padding:10px;font-size:11px;color:var(--rh-success-text);margin-bottom:12px;"></div>
                            <button onclick="window._ausRegistar()"
                                style="width:100%;background:var(--rh-accent);color:var(--rh-text);border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">
                                💾 Guardar Ausência
                            </button>
                        </div>

                        <!-- Lista de ausências registadas -->
                        <div style="background:var(--rh-bg-card);padding:20px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                            <h4 style="margin:0 0 14px;color:var(--rh-primary);font-size:13px;border-bottom:2px solid var(--rh-warning);padding-bottom:7px;">📋 Ausências Registadas</h4>
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

    // Ausências – a mais "grave" prevalece: injustificada > conta-falta (justificada que desconta) > resto
    const aus = S.ausencias.filter(a => a.dataInicio <= ds && ds <= a.dataFim);
    if (!aus.length) return 'presente';

    const peso = a => {
        const def = TIPOS_LABEL[a.tipo];
        if (!def) return 5;
        if (def.grupo === 'injustificada') return 0;
        if (def.contaFalta) return 1;
        return 2;
    };
    let melhor = aus.reduce((acc, a) => peso(a) < peso(acc) ? a : acc, aus[0]);
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

    const estilosBase = {
        antes_admissao:     { bg:'var(--rh-bg-muted)', border:'1px solid var(--rh-border)', color:'var(--rh-border)' },
        futuro:             { bg:'var(--rh-bg-muted)', border:'1px solid var(--rh-border)', color:'var(--rh-text-subtle)' },
        presente:           { bg:'var(--rh-success-bg)', border:'1px solid var(--rh-success)', color:'var(--rh-success-text)' },
        ferias:             { bg:'var(--rh-success-bg)', border:'2px solid var(--rh-success)', color:'var(--rh-success-text)' },
    };
    // Gera estilo para qualquer tipo de ausência a partir da sua cor definida em TIPOS_LABEL
    function estiloParaTipo(tipo) {
        const def = TIPOS_LABEL[tipo];
        if (!def) return estilosBase.presente;
        return { bg: def.cor + '26', border: `2px solid ${def.cor}`, color: def.cor };
    }

    let h = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">`;
    DIAS_SEMANA.forEach(d => h += `<div style="text-align:center;font-size:10px;font-weight:bold;color:var(--rh-text-subtle);padding:4px 0;">${d}</div>`);
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
            est = { bg:'var(--rh-bg-muted)', border:'1px solid var(--rh-border)', color:'var(--rh-text-subtle)' };
            title = isFeriado ? 'Feriado' : 'Fim de semana';
        } else {
            const estado = getDiaEstado(ds);
            est = estilosBase[estado] || estiloParaTipo(estado);
            title = estado === 'presente' ? 'Presente' :
                    estado === 'ferias'   ? 'Férias'   :
                    TIPOS_LABEL[estado]?.label || estado;
        }

        const hojeStyle = isHoje ? 'outline:2px solid var(--rh-primary);outline-offset:1px;' : '';

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
                // Subsídio de refeição:
                //  - dia normal (presente): tem direito
                //  - falta parcial (tipo 'hora', ex: consulta, deslocação à escola): depende das
                //    horas efetivamente trabalhadas nesse dia vs. o mínimo exigido pela empresa
                if (estado === 'presente') {
                    diasSubsidio++;
                } else if (usaHora(estado)) {
                    const avaliacao = avaliarSubsidioFaltaParcial(ds, S.func);
                    if (avaliacao.elegivel === true) diasSubsidio++;
                    else if (avaliacao.elegivel === null && temSubsidioRefeicao(estado)) {
                        // sem horário definido para avaliar: cai na regra estática do tipo
                        diasSubsidio++;
                    }
                }
            }
        }
        cur.setDate(cur.getDate() + 1);
    }

    const txAssiduidade = diasUteis > 0 ? ((diasPresente / diasUteis) * 100).toFixed(1) : '—';
    const valorSubsidio = (diasSubsidio * S.subsidioRefeicao).toLocaleString('pt-PT', {style:'currency',currency:'EUR'});

    el.innerHTML = [
        ['var(--rh-primary)', '📅', 'Dias Úteis', diasUteis, 'desde admissão'],
        ['var(--rh-success)', '✅', 'Dias Presente', diasPresente, 'para assiduidade'],
        ['var(--rh-danger)', '❌', 'Faltas/Baixas', diasFaltaAss, 'contam contra assiduidade'],
        ['var(--rh-warning)', `${txAssiduidade}%`, 'Taxa Assiduidade', '', ''],
        ['var(--rh-secondary)', '🍽️', 'Sub. Refeição', valorSubsidio, `${diasSubsidio} dias × ${S.subsidioRefeicao.toFixed(2)}€`],
    ].map(([cor, icon, lbl, val, sub]) => `
        <div style="background:var(--rh-bg-card);padding:16px;border-radius:10px;border-top:3px solid ${cor};
                    box-shadow:0 2px 4px rgba(0,0,0,0.04);text-align:center;">
            <div style="font-size:10px;color:var(--rh-text-muted);text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${lbl}</div>
            <div style="font-size:${lbl==='Taxa Assiduidade'?'20':'26'}px;font-weight:bold;color:var(--rh-primary);">${lbl==='Taxa Assiduidade'?icon:val||icon}</div>
            <div style="font-size:10px;color:var(--rh-text-subtle);margin-top:2px;">${sub}</div>
        </div>`).join('');
}

function contaComoFaltaAss(estado) {
    return !!TIPOS_LABEL[estado]?.contaFalta;
}

// ─── Lista de ausências ───────────────────────────────────────────────────────
function renderLista() {
    const el = document.getElementById('lista-ausencias');
    if (!el) return;
    const anoStr = String(S.anoMapa);
    const aus = S.ausencias.filter(a => a.dataInicio.startsWith(anoStr) || a.dataFim.startsWith(anoStr));
    if (!aus.length) {
        el.innerHTML = `<p style="color:var(--rh-text-subtle);font-style:italic;font-size:12px;margin:0;">Nenhuma ausência registada em ${anoStr}.</p>`;
        return;
    }
    el.innerHTML = aus.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio)).map(a => {
        const t = TIPOS_LABEL[a.tipo] || { label: a.tipo, cor:'var(--rh-text-subtle)', emoji:'?', baseLegal:'—' };
        const periodoTxt = usaHora(a.tipo) && a.horaInicio && a.horaFim
            ? `${formatDate(a.dataInicio)} ${a.horaInicio} → ${formatDate(a.dataFim)} ${a.horaFim}`
            : `${formatDate(a.dataInicio)} → ${formatDate(a.dataFim)}`;

        let sub;
        if (usaHora(a.tipo)) {
            const avaliacao = avaliarSubsidioFaltaParcial(a.dataInicio, S.func);
            if (avaliacao.elegivel === true) {
                sub = `🍽️ Sub. Refeição (trabalhou ${avaliacao.horasTrabalhadas.toFixed(1)}h ≥ mínimo ${S.horasMinSubsidio}h)`;
            } else if (avaliacao.elegivel === false) {
                sub = `— (trabalhou ${avaliacao.horasTrabalhadas.toFixed(1)}h, abaixo do mínimo ${S.horasMinSubsidio}h)`;
            } else {
                sub = temSubsidioRefeicao(a.tipo) ? '🍽️ Sub. Refeição (sem horário definido p/ avaliar)' : '— (sem horário definido p/ avaliar)';
            }
        } else {
            sub = temSubsidioRefeicao(a.tipo) ? '🍽️ Sub. Refeição' : '—';
        }

        return `
        <div style="border:1px solid var(--rh-border);border-radius:8px;padding:10px 12px;margin-bottom:8px;position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-size:12px;font-weight:bold;color:${t.cor};">${t.emoji} ${t.label}</span>
                <button onclick="window._ausEliminar('${a.id}')"
                    style="background:none;border:none;cursor:pointer;color:var(--rh-text-subtle);font-size:14px;padding:0 2px;" title="Eliminar">✕</button>
            </div>
            <div style="font-size:11px;color:var(--rh-text-muted);">
                📅 ${periodoTxt}
                ${a.nota ? `<br>📝 ${a.nota}` : ''}
                <br><span style="color:var(--rh-text-subtle);">${t.baseLegal}</span> · <span style="color:var(--rh-text-muted);">Sub. refeição: ${sub}</span>
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
    const tipo = document.getElementById('aus-tipo')?.value;
    const el   = document.getElementById('aus-regra');
    const horaWrap = document.getElementById('aus-hora-wrap');
    if (!el) return;

    const def = TIPOS_LABEL[tipo];
    if (horaWrap) horaWrap.style.display = (def && usaHora(tipo)) ? 'grid' : 'none';

    if (!def) { el.innerHTML = ''; return; }

    const assidTxt = def.contaFalta ? 'desconta' : 'presente (não desconta)';
    const limiteTxt = def.limite ? def.limite.texto : (def.limiteTexto || 'Conforme necessidade');

    let subTxt;
    if (usaHora(tipo)) {
        subTxt = S.horasMinSubsidio
            ? `depende das horas trabalhadas nesse dia (mínimo exigido: ${S.horasMinSubsidio}h)`
            : 'depende das horas trabalhadas nesse dia';
    } else {
        subTxt = def.subsidio ? 'tem direito' : 'não tem direito';
    }

    el.style.cssText = `background:${def.cor}15;border:1px solid ${def.cor};border-radius:6px;padding:10px;font-size:11px;color:${def.cor};margin-bottom:12px;`;
    el.innerHTML = `${def.emoji} <b>${def.baseLegal}</b> · Limite: <b>${limiteTxt}</b>
        <br>Assiduidade: <b>${assidTxt}</b>. Subsídio Refeição: <b>${subTxt}</b>.`;
}

// ─── Registar ausência ────────────────────────────────────────────────────────
window._ausRegistar = async function() {
    const tipo   = document.getElementById('aus-tipo').value;
    const inicio = document.getElementById('aus-inicio').value;
    const fim    = document.getElementById('aus-fim').value;
    const nota   = document.getElementById('aus-nota').value;
    const horaInicio = document.getElementById('aus-hora-inicio')?.value || '';
    const horaFim    = document.getElementById('aus-hora-fim')?.value || '';

    if (!inicio || !fim) { alert('Por favor preencha as datas de início e fim.'); return; }
    if (fim < inicio)    { alert('A data de fim não pode ser anterior à data de início.'); return; }

    if (usaHora(tipo)) {
        if (!horaInicio || !horaFim) { alert('Por favor preencha a hora de início e de fim.'); return; }
        if (inicio === fim && horaFim <= horaInicio) {
            alert('A hora de fim deve ser posterior à hora de início.');
            return;
        }
    }

    const nova = { id: `${S.funcId}_${Date.now()}`, tipo, dataInicio: inicio, dataFim: fim, nota };
    if (usaHora(tipo)) { nova.horaInicio = horaInicio; nova.horaFim = horaFim; }

    // ─── Validação de limite legal (aviso, não bloqueio) ───
    const def = TIPOS_LABEL[tipo];
    if (def && def.limite && def.limite.valor !== undefined) {
        const unidadeTxt = def.unidade === 'hora' ? 'horas' : 'dias';
        const novaQtd = contarUnidades(nova, def.unidade);

        if (def.limite.periodo === 'consecutivos') {
            if (novaQtd > def.limite.valor) {
                const seguir = confirm(
                    `⚠️ Atenção: "${def.label}" permite no máximo ${def.limite.texto}.\n` +
                    `Este registo tem ${novaQtd} ${unidadeTxt}, o que excede o limite legal.\n\n` +
                    `Deseja registar mesmo assim?`
                );
                if (!seguir) return;
            }
        } else if (def.limite.periodo) {
            const { usado } = calcularUsoAcumulado(tipo, inicio, null);
            const total = usado + novaQtd;
            if (total > def.limite.valor) {
                const seguir = confirm(
                    `⚠️ Atenção: "${def.label}" permite no máximo ${def.limite.texto}.\n` +
                    `Já foram usados ${usado} ${unidadeTxt} no período correspondente; este registo (${novaQtd} ${unidadeTxt}) ` +
                    `eleva o total para ${total} ${unidadeTxt}, excedendo o limite.\n\n` +
                    `Deseja registar mesmo assim?`
                );
                if (!seguir) return;
            }
        } else if (def.limite.valor === 0) {
            // ex: falta injustificada — apenas informativo, sem bloqueio
        }
    }

    S.ausencias.push(nova);

    await guardarAusencias();
    renderCal();
    renderLista();

    // limpar form
    document.getElementById('aus-inicio').value = '';
    document.getElementById('aus-fim').value = '';
    document.getElementById('aus-nota').value = '';
    if (document.getElementById('aus-hora-inicio')) document.getElementById('aus-hora-inicio').value = '';
    if (document.getElementById('aus-hora-fim'))    document.getElementById('aus-hora-fim').value = '';
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
    S.horasMinSubsidio = 0;

    // Parâmetros
    try {
        const ps = await getDoc(doc(db, 'configuracoes', 'empresa_base'));
        if (ps.exists()) {
            const pd = ps.data();
            S.subsidioRefeicao = pd.subsidioRefeicao || 0;
            S.horasMinSubsidio = pd.horasMinSubsidio || 0;
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

    // Data início → preenche data fim automaticamente
    document.getElementById('aus-inicio').addEventListener('change', e => {
        const fim = document.getElementById('aus-fim');
        if (!fim.value) fim.value = e.target.value;
    });
}
