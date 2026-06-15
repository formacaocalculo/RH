// ================================================================
//  modules/dashboard.js
//  Módulo: Dashboard principal com KPIs e últimos processamentos.
//
//  Contrato: exportar default { init }
//    init()  → injeta HTML em #appContent, regista eventos,
//              devolve cleanup() se necessário.
// ================================================================

import { listarFuncionarios, listarVencimentos, fmt } from "../app.js";
import { renderPage, toast } from "../ui.js";

// ── Template HTML ───────────────────────────────────────────────
function html() {
  return `
    <div class="kpi-grid">
      <div class="kpi" style="--kpi-accent:var(--c-blue)">
        <div class="kpi__icon">👥</div>
        <div class="kpi__label">Total Colaboradores</div>
        <div class="kpi__value" id="kpiColaboradores">—</div>
        <div class="kpi__sub">Activos no sistema</div>
      </div>
      <div class="kpi" style="--kpi-accent:var(--c-ok)">
        <div class="kpi__icon">💶</div>
        <div class="kpi__label">Massa Salarial Bruta</div>
        <div class="kpi__value" id="kpiBruto">—</div>
        <div class="kpi__sub" id="kpiBrutoMes">—</div>
      </div>
      <div class="kpi" style="--kpi-accent:var(--c-amber)">
        <div class="kpi__icon">📋</div>
        <div class="kpi__label">Vencimentos Processados</div>
        <div class="kpi__value" id="kpiProcessados">—</div>
        <div class="kpi__sub" id="kpiProcessadosMes">—</div>
      </div>
      <div class="kpi" style="--kpi-accent:var(--c-err)">
        <div class="kpi__icon">🏦</div>
        <div class="kpi__label">Total Descontos</div>
        <div class="kpi__value" id="kpiDescontos">—</div>
        <div class="kpi__sub">SS + IRS (mês actual)</div>
      </div>
    </div>

    <div class="card">
      <div class="card__head">
        <span class="card__title">Últimos Processamentos</span>
        <a href="#processamento" class="btn btn--secondary btn--sm">Processar novo →</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Colaborador</th><th>Mês / Ano</th><th>Salário Bruto</th>
              <th>Líquido</th><th>SS</th><th>IRS</th><th>Estado</th>
            </tr>
          </thead>
          <tbody id="tabelaResumo">
            <tr><td colspan="7" class="empty-state">A carregar…</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Lógica ──────────────────────────────────────────────────────
async function carregar() {
  const agora      = new Date();
  const mesActual  = agora.getMonth() + 1;
  const anoActual  = agora.getFullYear();

  try {
    const [funcs, vencs] = await Promise.all([
      listarFuncionarios(),
      listarVencimentos({ mes: mesActual, ano: anoActual }),
    ]);

    const totalBruto     = vencs.reduce((s, v) => s + (v.bruto ?? 0), 0);
    const totalDescontos = vencs.reduce((s, v) => s + (v.ss ?? 0) + (v.irs ?? 0), 0);
    const nomeMes        = `${fmt.mes(mesActual)} ${anoActual}`;

    document.getElementById("kpiColaboradores").textContent  = funcs.length;
    document.getElementById("kpiBruto").textContent          = fmt.euros(totalBruto);
    document.getElementById("kpiDescontos").textContent      = fmt.euros(totalDescontos);
    document.getElementById("kpiProcessados").textContent    = vencs.length;
    document.getElementById("kpiBrutoMes").textContent       = nomeMes;
    document.getElementById("kpiProcessadosMes").textContent = nomeMes;

    const mapaFunc = Object.fromEntries(funcs.map(f => [f.id, f.nome]));
    const tbody    = document.getElementById("tabelaResumo");

    if (!vencs.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">
        Nenhum processamento em ${nomeMes}.
        <a href="#processamento">Processar agora →</a>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = vencs.map(v => `
      <tr>
        <td><strong>${mapaFunc[v.funcionarioId] ?? "—"}</strong></td>
        <td>${fmt.mes(v.mes)} ${v.ano}</td>
        <td>${fmt.euros(v.bruto)}</td>
        <td><strong>${fmt.euros(v.liquido)}</strong></td>
        <td>${fmt.euros(v.ss)}</td>
        <td>${fmt.euros(v.irs)}</td>
        <td><span class="badge badge--ok">Processado</span></td>
      </tr>`).join("");

  } catch (e) {
    console.error("[dashboard]", e);
    document.getElementById("tabelaResumo").innerHTML =
      `<tr><td colspan="7" class="empty-state">Erro ao carregar. Verifique a configuração do Firebase.</td></tr>`;
  }
}

// ── Exportação do módulo ─────────────────────────────────────────
export default {
  async init() {
    renderPage(html());
    await carregar();
    // sem eventos persistentes → sem cleanup necessário
  },
};
