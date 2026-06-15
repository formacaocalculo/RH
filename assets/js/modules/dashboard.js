// assets/js/modules/dashboard.js
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
                <a href="#" style="display: block; color: #fff; background-color: #3b82f6; padding: 10px; border-radius: 6px; text-decoration: none; margin-bottom: 20px;">📊 Dashboard</a>
                
                <p style="color: #4f5d73; font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 10px;">Gestão</p>
                <a href="#" style="display: block; color: #8a99ad; padding: 10px; text-decoration: none;">👥 Colaboradores</a>
                <a href="#" style="display: block; color: #8a99ad; padding: 10px; text-decoration: none;">⚙️ Processamento</a>
                <a href="#" style="display: block; color: #8a99ad; padding: 10px; text-decoration: none;">📄 Recibos</a>
            </nav>
        </aside>

        <main class="main-content" style="flex: 1; padding: 30px;">
            <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <h2 style="margin: 0; font-size: 24px; color: #1a233a;">Dashboard</h2>
                <span style="color: #64748b; font-size: 14px;">domingo, 14 de junho de 2026</span>
            </header>

            <div class="cards-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
                <div style="background: #fff; padding: 20px; border-radius: 12px; border-top: 4px solid #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <small style="color: #64748b; text-transform: uppercase; font-size: 11px; font-weight: bold;">Total Colaboradores</small>
                    <h3 style="margin: 10px 0 5px 0; font-size: 28px; color: #1a233a;">—</h3>
                    <small style="color: #94a3b8;">Ativos no sistema</small>
                </div>
                <div style="background: #fff; padding: 20px; border-radius: 12px; border-top: 4px solid #10b981; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <small style="color: #64748b; text-transform: uppercase; font-size: 11px; font-weight: bold;">Massa Salarial Bruta</small>
                    <h3 style="margin: 10px 0 5px 0; font-size: 28px; color: #1a233a;">—</h3>
                    <small style="color: #94a3b8;">Este mês</small>
                </div>
                <div style="background: #fff; padding: 20px; border-radius: 12px; border-top: 4px solid #f59e0b; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <small style="color: #64748b; text-transform: uppercase; font-size: 11px; font-weight: bold;">Vencimentos Processados</small>
                    <h3 style="margin: 10px 0 5px 0; font-size: 28px; color: #1a233a;">—</h3>
                    <small style="color: #94a3b8;">Este mês</small>
                </div>
                <div style="background: #fff; padding: 20px; border-radius: 12px; border-top: 4px solid #ef4444; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <small style="color: #64748b; text-transform: uppercase; font-size: 11px; font-weight: bold;">Total Descontos</small>
                    <h3 style="margin: 10px 0 5px 0; font-size: 28px; color: #1a233a;">—</h3>
                    <small style="color: #94a3b8;">SS + IRS (mês actual)</small>
                </div>
            </div>

            <div style="background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h4 style="margin: 0; font-size: 16px; color: #1a233a;">Últimos Processamentos</h4>
                    <button style="background-color: #3b82f6; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;">Processar novo →</button>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead>
                        <tr style="color: #94a3b8; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size: 11px;">
                            <th style="padding: 12px 0;">Colaborador</th>
                            <th>Mês / Ano</th>
                            <th>Salário Bruto</th>
                            <th>Líquido</th>
                            <th>SS</th>
                            <th>IRS</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody id="tabela-processamentos">
                        </tbody>
                </table>
                
                <div id="mensagem-status" style="text-align: center; color: #94a3b8; padding: 40px 0; font-style: italic;">
                    Carregando dados do painel...
                </div>
            </div>
        </main>
    </div>
    `;
}

export function init() {
    // Aqui virá a tua função de ler os dados do Firestore futuramente
    console.log("Módulo do Dashboard Inicializado com sucesso!");
}