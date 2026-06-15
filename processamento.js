// ================================================================
//  modules/processamento.js
//  Módulo: Motor de cálculo de vencimentos mensais.
// ================================================================

import { listarFuncionarios, calcularVencimento, gravarVencimento, fmt } from "../app.js";
import { toast, spinner, renderPage, populateMeses, populateAnos } from "../ui.js";

let funcionarios = [];
let ultimoCalc   = null;

// ── Template ─────────────────────────────────────────────────────
function html() {
  return `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-5);align-items:start">

    <!-- Parâmetros -->
    <div>
      <div class="card" style="margin-bottom:var(--sp-4)">
        <div class="card__head"><span class="card__title">Parâmetros</span></div>
        <div class="card__body">
          <div class="form-grid">
            <div class="form-group">
              <label for="pMes">Mês *</label>
              <select id="pMes"></select>
            </div>
            <div class="form-group">
              <label for="pAno">Ano *</label>
              <select id="pAno"></select>
            </div>
            <div class="form-group form-group--full">
              <label for="pFunc">Colaborador *</label>
              <select id="pFunc"><option value="">Seleccionar…</option></select>
            </div>
            <div class="form-group">
              <label for="pHorasExtra">Horas Extra</label>
              <input type="number" id="pHorasExtra" value="0" min="0" step="0.5">
              <span class="hint">Remuneradas a 150% do valor/hora</span>
            </div>
            <div class="form-group">
              <label for="pFaltas">Faltas Injustificadas</label>
              <input type="number" id="pFaltas" value="0" min="0" step="1">
              <span class="hint">Dias sem justificação</span>
            </div>
          </div>
          <button class="btn btn--primary" id="btnCalcular" style="width:100%;margin-top:var(--sp-5)">
            Calcular Vencimento
          </button>
        </div>
      </div>

      <!-- Tabela IRS -->
      <div class="card">
        <div class="card__head"><span class="card__title">Escalões IRS 2024</span></div>
        <div class="card__body" style="padding:0">
          <table>
            <thead><tr><th>Salário Bruto (mensal)</th><th>Taxa IRS</th></tr></thead>
            <tbody>
              <tr><td>Até 778 €</td><td><span class="badge badge--ok">0%</span></td></tr>
              <tr><td>778 € – 1 000 €</td><td><span class="badge badge--ok">14,5%</span></td></tr>
              <tr><td>1 000 € – 1 500 €</td><td><span class="badge badge--blue">21,5%</span></td></tr>
              <tr><td>1 500 € – 2 000 €</td><td><span class="badge badge--blue">26,5%</span></td></tr>
              <tr><td>2 000 € – 2 500 €</td><td><span class="badge badge--amber">28,5%</span></td></tr>
              <tr><td>2 500 € – 3 200 €</td><td><span class="badge badge--amber">35,0%</span></td></tr>
              <tr><td>3 200 € – 4 100 €</td><td><span class="badge badge--amber">37,0%</span></td></tr>
              <tr><td>4 100 € – 5 000 €</td><td><span class="badge badge--err">43,5%</span></td></tr>
              <tr><td>Acima de 5 000 €</td><td><span class="badge badge--err">48,0%</span></td></tr>
            </tbody>
          </table>
          <p style="padding:var(--sp-3) var(--sp-4);font-size:.72rem;color:var(--c-ink-3)">
            Tabela simplificada. SS trabalhador: 11%. Verificar IRS.gov.pt.
          </p>
        </div>
      </div>
    </div>

    <!-- Resultado -->
    <div>
      <div id="placeholderCalc" class="card">
        <div class="card__body" style="text-align:center;padding:var(--sp-7);color:var(--c-ink-3)">
          <div style="font-size:3rem;margin-bottom:var(--sp-4)">⚙️</div>
          <p>Seleccione um colaborador e clique em <strong>Calcular</strong>.</p>
        </div>
      </div>

      <div id="resultadoCalc" style="display:none">
        <div class="card" style="margin-bottom:var(--sp-4)">
          <div class="card__head">
            <div>
              <div class="card__title" id="rNome">—</div>
              <div style="font-size:.8rem;color:var(--c-ink-3);margin-top:2px" id="rPeriodo">—</div>
            </div>
            <span class="badge badge--amber">Calculado</span>
          </div>
          <div class="card__body">
            <p class="recibo__secao-label" style="margin-bottom:var(--sp-3)">Abonos</p>
            <div class="result-grid">
              <div class="result-item">
                <div class="result-item__label">Salário Base</div>
                <div class="result-item__val result-item--blue" id="rSalBase">—</div>
              </div>
              <div class="result-item">
                <div class="result-item__label">Horas Extra</div>
                <div class="result-item__val result-item--blue" id="rHExtra">—</div>
              </div>
              <div class="result-item" style="grid-column:1/-1">
                <div class="result-item__label">Salário Bruto</div>
                <div class="result-item__val" id="rBruto" style="font-size:1.3rem">—</div>
              </div>
            </div>

            <p class="recibo__secao-label" style="margin:var(--sp-4) 0 var(--sp-3)">Descontos</p>
            <div class="result-grid">
              <div class="result-item">
                <div class="result-item__label">Seg. Social (11%)</div>
                <div class="result-item__val result-item--neg" id="rSS">—</div>
              </div>
              <div class="result-item">
                <div class="result-item__label">IRS (taxa <span id="rTaxaIRS">—</span>)</div>
                <div class="result-item__val result-item--neg" id="rIRS">—</div>
              </div>
              <div class="result-item">
                <div class="result-item__label">Desc. Faltas</div>
                <div class="result-item__val result-item--neg" id="rFaltas">—</div>
              </div>
            </div>

            <div style="margin-top:var(--sp-5);background:var(--c-ink);color:#fff;border-radius:var(--radius);padding:var(--sp-4) var(--sp-5);display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:.85rem;letter-spacing:.3px">SALÁRIO LÍQUIDO A PAGAR</span>
              <span style="font-size:1.5rem;font-weight:700;font-family:var(--font-mono)" id="rLiquido">—</span>
            </div>
          </div>
        </div>

        <div class="btn-group">
          <button class="btn btn--primary" id="btnGravar" style="flex:1">💾 Gravar no Firebase</button>
          <a href="#recibos" class="btn btn--secondary">Ver Recibos →</a>
        </div>
        <p style="font-size:.72rem;color:var(--c-ink-3);margin-top:var(--sp-3)">
          Gravar substitui o registo se já existir um para este mês/colaborador.
        </p>
      </div>
    </div>
  </div>`;
}

// ── Lógica ────────────────────────────────────────────────────────
async function carregarFuncionarios() {
  funcionarios = await listarFuncionarios();
  const sel = document.getElementById("pFunc");
  sel.innerHTML = `<option value="">Seleccionar…</option>` +
    funcionarios.map(f => `<option value="${f.id}">${f.nome} — ${fmt.euros(f.salarioBase)}</option>`).join("");
}

function calcular() {
  const funcId = document.getElementById("pFunc").value;
  const mes    = +document.getElementById("pMes").value;
  const ano    = +document.getElementById("pAno").value;
  if (!funcId || !mes || !ano) { toast("Seleccione colaborador, mês e ano.", "err"); return; }

  const func   = funcionarios.find(f => f.id === funcId);
  if (!func) return;
  const hExtra = +document.getElementById("pHorasExtra").value || 0;
  const faltas = +document.getElementById("pFaltas").value || 0;
  const calc   = calcularVencimento(func.salarioBase, hExtra, faltas);
  ultimoCalc   = { funcionarioId: funcId, mes, ano, calc };

  document.getElementById("rNome").textContent     = func.nome;
  document.getElementById("rPeriodo").textContent  = `${fmt.mes(mes)} ${ano}`;
  document.getElementById("rSalBase").textContent  = fmt.euros(calc.salarioBase);
  document.getElementById("rHExtra").textContent   = hExtra > 0 ? `${fmt.euros(calc.valorHorasExtra)} (${hExtra}h)` : "—";
  document.getElementById("rBruto").textContent    = fmt.euros(calc.bruto);
  document.getElementById("rSS").textContent       = `− ${fmt.euros(calc.ss)}`;
  document.getElementById("rTaxaIRS").textContent  = fmt.pct(calc.taxaIRS);
  document.getElementById("rIRS").textContent      = `− ${fmt.euros(calc.irs)}`;
  document.getElementById("rFaltas").textContent   = faltas > 0 ? `− ${fmt.euros(calc.descontoFaltas)} (${faltas}d)` : "—";
  document.getElementById("rLiquido").textContent  = fmt.euros(calc.liquido);

  document.getElementById("placeholderCalc").style.display = "none";
  document.getElementById("resultadoCalc").style.display   = "block";
}

async function gravar() {
  if (!ultimoCalc) return;
  const btn = document.getElementById("btnGravar");
  spinner(btn, true);
  try {
    await gravarVencimento(ultimoCalc.funcionarioId, ultimoCalc.mes, ultimoCalc.ano, ultimoCalc.calc);
    toast("Vencimento gravado no Firebase.", "ok");
  } catch (e) {
    console.error("[processamento]", e);
    toast("Erro ao gravar.", "err");
  } finally {
    spinner(btn, false);
  }
}

// ── Exportação ────────────────────────────────────────────────────
export default {
  async init() {
    renderPage(html());
    populateMeses(document.getElementById("pMes"), new Date().getMonth() + 1);
    populateAnos(document.getElementById("pAno"));
    document.getElementById("btnCalcular").addEventListener("click", calcular);
    document.getElementById("btnGravar").addEventListener("click",   gravar);
    await carregarFuncionarios();
    return () => { funcionarios = []; ultimoCalc = null; };
  },
};
