// ================================================================
//  modules/recibos.js
//  Módulo: Consulta e impressão de recibos de vencimento.
// ================================================================

import { listarFuncionarios, listarVencimentos, fmt } from "../app.js";
import { toast, semDados, renderPage, populateMeses, populateAnos } from "../ui.js";

let funcionarios = [];
let vencimentos  = [];

// ── Template ─────────────────────────────────────────────────────
function html() {
  return `
    <!-- Filtros -->
    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="filter-bar">
        <div class="form-group">
          <label for="fFunc">Colaborador</label>
          <select id="fFunc"><option value="">Todos</option></select>
        </div>
        <div class="form-group">
          <label for="fMes">Mês</label>
          <select id="fMes"><option value="">Todos os meses</option></select>
        </div>
        <div class="form-group">
          <label for="fAno">Ano</label>
          <select id="fAno"></select>
        </div>
        <div class="form-group" style="justify-content:flex-end">
          <label>&nbsp;</label>
          <button class="btn btn--primary" id="btnFiltrar">Pesquisar</button>
        </div>
      </div>
    </div>

    <!-- Tabela -->
    <div class="card" id="cardTabela">
      <div class="card__head">
        <span class="card__title">Recibos Emitidos</span>
        <span class="badge badge--blue" id="contadorRecibos">0 registos</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Colaborador</th><th>Período</th><th>Bruto</th>
              <th>IRS</th><th>Seg. Social</th><th>Líquido</th><th>Acção</th>
            </tr>
          </thead>
          <tbody id="tabelaRecibos">
            <tr><td colspan="7" class="empty-state">Use os filtros para pesquisar recibos.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recibo visual -->
    <div id="reciboView" style="display:none;margin-top:var(--sp-5)">
      <div class="btn-group" style="margin-bottom:var(--sp-4)">
        <button class="btn btn--secondary" id="btnVoltarLista">← Voltar à lista</button>
        <button class="btn btn--primary"   onclick="window.print()">🖨️ Imprimir</button>
      </div>
      <div class="recibo" id="reciboConteudo">
        <div class="recibo__header">
          <div>
            <div class="recibo__empresa">Empresa, Lda.</div>
            <div style="font-size:.8rem;color:var(--c-ink-3);margin-top:2px">NIF: 123 456 789</div>
          </div>
          <div style="text-align:right">
            <div class="recibo__title">Recibo de Vencimento</div>
            <div class="recibo__periodo" id="rTituloPeriodo">—</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);padding:var(--sp-4);background:var(--c-canvas);border-radius:var(--radius)">
          <div>
            <div style="font-size:.7rem;color:var(--c-ink-3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:var(--sp-1)">Colaborador</div>
            <div style="font-weight:700;font-size:1rem" id="rNome">—</div>
          </div>
          <div>
            <div style="font-size:.7rem;color:var(--c-ink-3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:var(--sp-1)">NIF</div>
            <div id="rNif">—</div>
          </div>
          <div>
            <div style="font-size:.7rem;color:var(--c-ink-3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:var(--sp-1)">IBAN</div>
            <div style="font-family:var(--font-mono);font-size:.85rem" id="rIban">—</div>
          </div>
          <div>
            <div style="font-size:.7rem;color:var(--c-ink-3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:var(--sp-1)">Categoria</div>
            <div id="rCategoria">—</div>
          </div>
        </div>

        <div class="recibo__grid">
          <div>
            <div class="recibo__secao-label">Abonos</div>
            <div class="recibo__linha">
              <span class="recibo__linha-label">Salário Base</span>
              <span class="recibo__linha-val" id="rSalBase">—</span>
            </div>
            <div class="recibo__linha" id="rLinhaHE">
              <span class="recibo__linha-label">Horas Extra (<span id="rHorasQt">0</span>h)</span>
              <span class="recibo__linha-val" id="rHorasVal">—</span>
            </div>
            <div class="recibo__linha" style="border-top:2px solid var(--c-ink);margin-top:var(--sp-2);padding-top:var(--sp-2)">
              <span class="recibo__linha-label"><strong>Total Abonos</strong></span>
              <span class="recibo__linha-val" id="rBruto">—</span>
            </div>
          </div>
          <div>
            <div class="recibo__secao-label">Descontos</div>
            <div class="recibo__linha">
              <span class="recibo__linha-label">IRS (<span id="rTaxaIRS">0</span>%)</span>
              <span class="recibo__linha-val" id="rIRS">—</span>
            </div>
            <div class="recibo__linha">
              <span class="recibo__linha-label">Seg. Social (11%)</span>
              <span class="recibo__linha-val" id="rSS">—</span>
            </div>
            <div class="recibo__linha" id="rLinhaFaltas">
              <span class="recibo__linha-label">Desc. Faltas (<span id="rFaltasQt">0</span>d)</span>
              <span class="recibo__linha-val" id="rFaltasVal">—</span>
            </div>
            <div class="recibo__linha" style="border-top:2px solid var(--c-ink);margin-top:var(--sp-2);padding-top:var(--sp-2)">
              <span class="recibo__linha-label"><strong>Total Descontos</strong></span>
              <span class="recibo__linha-val" id="rTotalDesc">—</span>
            </div>
          </div>
        </div>

        <div class="recibo__total">
          <span class="recibo__total-label">LÍQUIDO A RECEBER</span>
          <span class="recibo__total-val" id="rLiquido">—</span>
        </div>

        <div class="recibo__assinaturas">
          <div class="recibo__assinatura">Responsável de RH</div>
          <div class="recibo__assinatura">Colaborador (data e assinatura)</div>
        </div>
      </div>
    </div>`;
}

// ── Lógica ────────────────────────────────────────────────────────
async function pesquisar() {
  const funcId = document.getElementById("fFunc").value;
  const mes    = document.getElementById("fMes").value;
  const ano    = document.getElementById("fAno").value;
  try {
    vencimentos = await listarVencimentos({
      funcionarioId: funcId || undefined,
      mes:           mes ? +mes : undefined,
      ano:           ano ? +ano : undefined,
    });
    renderTabela();
  } catch (e) {
    console.error("[recibos]", e);
    toast("Erro ao pesquisar.", "err");
  }
}

function renderTabela() {
  const tbody = document.getElementById("tabelaRecibos");
  document.getElementById("contadorRecibos").textContent =
    `${vencimentos.length} registo${vencimentos.length !== 1 ? "s" : ""}`;
  const mapaFunc = Object.fromEntries(funcionarios.map(f => [f.id, f]));

  if (!vencimentos.length) { semDados(tbody, 7, "Nenhum recibo encontrado."); return; }
  tbody.innerHTML = vencimentos.map(v => {
    const f = mapaFunc[v.funcionarioId];
    return `<tr>
      <td><strong>${f?.nome ?? "—"}</strong></td>
      <td>${fmt.mes(v.mes)} ${v.ano}</td>
      <td>${fmt.euros(v.bruto)}</td>
      <td>${fmt.euros(v.irs)} <span style="color:var(--c-ink-3);font-size:.75rem">(${v.taxaIRS}%)</span></td>
      <td>${fmt.euros(v.ss)}</td>
      <td><strong>${fmt.euros(v.liquido)}</strong></td>
      <td><button class="btn btn--secondary btn--sm" data-recibo="${v.id}">Ver Recibo</button></td>
    </tr>`;
  }).join("");
}

function verRecibo(id) {
  const v = vencimentos.find(x => x.id === id);
  if (!v) return;
  const f = funcionarios.find(x => x.id === v.funcionarioId);

  document.getElementById("rTituloPeriodo").textContent  = `${fmt.mes(v.mes)} ${v.ano}`;
  document.getElementById("rNome").textContent      = f?.nome     ?? "—";
  document.getElementById("rNif").textContent       = f?.nif      ?? "—";
  document.getElementById("rIban").textContent      = f?.iban     ?? "—";
  document.getElementById("rCategoria").textContent = f?.categoria ?? "—";
  document.getElementById("rSalBase").textContent   = fmt.euros(v.salarioBase);
  document.getElementById("rHorasQt").textContent   = v.horasExtra ?? 0;
  document.getElementById("rHorasVal").textContent  = fmt.euros(v.valorHorasExtra ?? 0);
  document.getElementById("rLinhaHE").style.display = v.horasExtra > 0 ? "" : "none";
  document.getElementById("rBruto").textContent     = fmt.euros(v.bruto);
  document.getElementById("rTaxaIRS").textContent   = v.taxaIRS;
  document.getElementById("rIRS").textContent       = fmt.euros(v.irs);
  document.getElementById("rSS").textContent        = fmt.euros(v.ss);
  document.getElementById("rFaltasQt").textContent  = v.faltas ?? 0;
  document.getElementById("rFaltasVal").textContent = fmt.euros(v.descontoFaltas ?? 0);
  document.getElementById("rLinhaFaltas").style.display = v.faltas > 0 ? "" : "none";
  document.getElementById("rTotalDesc").textContent = fmt.euros((v.irs ?? 0) + (v.ss ?? 0) + (v.descontoFaltas ?? 0));
  document.getElementById("rLiquido").textContent   = fmt.euros(v.liquido);

  document.getElementById("cardTabela").style.display  = "none";
  document.querySelector(".filter-bar")?.closest(".card").style.setProperty("display","none");
  document.getElementById("reciboView").style.display  = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function voltarLista() {
  document.getElementById("cardTabela").style.display = "";
  document.querySelector(".filter-bar")?.closest(".card").style.removeProperty("display");
  document.getElementById("reciboView").style.display = "none";
}

// ── Exportação ────────────────────────────────────────────────────
export default {
  async init() {
    renderPage(html());
    populateMeses(document.getElementById("fMes"));
    populateAnos(document.getElementById("fAno"));

    funcionarios = await listarFuncionarios();
    const sel = document.getElementById("fFunc");
    sel.innerHTML += funcionarios.map(f => `<option value="${f.id}">${f.nome}</option>`).join("");

    document.getElementById("btnFiltrar").addEventListener("click", pesquisar);
    document.getElementById("btnVoltarLista").addEventListener("click", voltarLista);

    // Delegação: tabela → ver recibo
    document.getElementById("tabelaRecibos").addEventListener("click", e => {
      const btn = e.target.closest("[data-recibo]");
      if (btn) verRecibo(btn.dataset.recibo);
    });

    await pesquisar();
    return () => { funcionarios = []; vencimentos = []; };
  },
};
