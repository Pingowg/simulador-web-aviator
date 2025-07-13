document.addEventListener("DOMContentLoaded", () => {
  const configSection = document.getElementById("config-section");
  const gameSection = document.getElementById("game-section");
  const historySection = document.getElementById("history-section");
  const strategySection = document.getElementById("strategy-section");

  const saldoInicialInput = document.getElementById("saldoInicial");
  const apostaMinimaInput = document.getElementById("apostaMinima");
  const apostaMaximaInput = document.getElementById("apostaMaxima");
  const configGameBtn = document.getElementById("configGameBtn");

  const currentBalanceSpan = document.getElementById("currentBalance");
  const currentStrategySpan = document.getElementById("currentStrategy");
  const betAmountInput = document.getElementById("betAmount");
  const manualCashoutInput = document.getElementById("manualCashout");
  const autoCashoutInput = document.getElementById("autoCashout");
  const playRoundBtn = document.getElementById("playRoundBtn");
  const gameMessagePara = document.getElementById("gameMessage");
  const roundResultPara = document.getElementById("roundResult");

  const showHistoryBtn = document.getElementById("showHistoryBtn");
  const changeStrategyBtn = document.getElementById("changeStrategyBtn");
  const resetGameBtn = document.getElementById("resetGameBtn");
  const closeHistoryBtn = document.getElementById("closeHistoryBtn");
  const historyListDiv = document.getElementById("historyList");

  const strategyBtns = document.querySelectorAll(".strategy-btn");
  const cancelStrategyBtn = document.getElementById("cancelStrategyBtn");

  let currentGameState = {}; // Para armazenar o estado do jogo do backend

  // --- Funções de UI ---

  function showSection(sectionId) {
    configSection.style.display = "none";
    gameSection.style.display = "none";
    historySection.style.display = "none";
    strategySection.style.display = "none";

    document.getElementById(sectionId).style.display = "block";
  }

  function updateGameUI(state) {
    currentBalanceSpan.textContent = `R$ ${state.saldo.toFixed(2)}`;
    currentStrategySpan.textContent = getStrategyName(state.estrategia_ativa);
    betAmountInput.min = state.aposta_minima;
    betAmountInput.max = state.aposta_maxima;

    // Desabilita campos de saque se for Martingale
    const isMartingale = state.estrategia_ativa === "2";
    manualCashoutInput.disabled = isMartingale;
    autoCashoutInput.disabled = isMartingale;

    // Se for Martingale e perdeu a última, atualiza aposta para a próxima rodada (feedback visual)
    if (isMartingale && state.perdeu_ultima_martingale) {
      let nextBet = state.ultima_aposta_martingale * 2;
      // Ajusta para limites e saldo (simula lógica do backend)
      if (nextBet > state.saldo) nextBet = state.saldo;
      if (nextBet < state.aposta_minima && state.saldo >= state.aposta_minima)
        nextBet = state.aposta_minima;
      else if (
        nextBet < state.aposta_minima &&
        state.saldo < state.aposta_minima
      )
        nextBet = state.saldo;
      if (nextBet > state.aposta_maxima) nextBet = state.aposta_maxima;

      betAmountInput.value = nextBet.toFixed(2);
      gameMessagePara.textContent = `Estratégia Martingale: Próxima aposta será R$${nextBet.toFixed(
        2
      )}.`;
    } else if (
      isMartingale &&
      !state.perdeu_ultima_martingale &&
      state.aposta_base_martingale > 0
    ) {
      betAmountInput.value = state.aposta_base_martingale.toFixed(2);
      gameMessagePara.textContent = `Estratégia Martingale: Aposta base R$${state.aposta_base_martingale.toFixed(
        2
      )}.`;
    } else if (isMartingale && state.aposta_base_martingale === 0) {
      gameMessagePara.textContent =
        "Estratégia Martingale: Digite sua aposta base inicial.";
      betAmountInput.value = state.aposta_minima; // Sugere aposta minima
    } else {
      gameMessagePara.textContent = ""; // Limpa mensagem da estratégia
      // Mantém a última aposta ou valor padrão se não for martingale
      if (parseFloat(betAmountInput.value) < state.aposta_minima) {
        betAmountInput.value = state.aposta_minima;
      }
    }
  }

  function getStrategyName(strategyCode) {
    switch (strategyCode) {
      case "1":
        return "Manual";
      case "2":
        return "Martingale";
      case "3":
        return "Nenhuma";
      default:
        return "Desconhecida";
    }
  }

  function displayMessage(message, isError = false) {
    gameMessagePara.textContent = message;
    gameMessagePara.style.color = isError ? "#ff8888" : "#ffe066";
  }

  function displayRoundResult(result) {
    roundResultPara.textContent = result.mensagem;
    roundResultPara.className = "round-result"; // Limpa classes anteriores
    if (result.ganho_rodada < 0) {
      roundResultPara.classList.add("lose");
    } else {
      roundResultPara.classList.add("win");
    }
    updateGameUI(currentGameState); // Atualiza UI após resultado
  }

  function clearMessages() {
    gameMessagePara.textContent = "";
    roundResultPara.textContent = "";
    roundResultPara.classList.remove("win", "lose");
  }

  // --- Chamadas de API ---

  async function fetchGameState() {
    try {
      const response = await fetch("/api/get_game_state");
      const data = await response.json();
      if (data.success) {
        currentGameState = data;
        updateGameUI(currentGameState);
        // Se o jogo já estiver configurado, mostra a seção do jogo
        if (currentGameState.saldo_inicial_configurado) {
          showSection("game-section");
        } else {
          showSection("config-section");
        }
      } else {
        displayMessage(
          "Erro ao carregar estado do jogo: " + data.message,
          true
        );
      }
    } catch (error) {
      displayMessage("Erro de conexão com o servidor.", true);
      console.error("Erro ao buscar estado do jogo:", error);
    }
  }

  async function initGame() {
    const saldoInicial = parseFloat(saldoInicialInput.value);
    const apostaMinima = parseFloat(apostaMinimaInput.value);
    const apostaMaxima = parseFloat(apostaMaximaInput.value);

    if (
      isNaN(saldoInicial) ||
      isNaN(apostaMinima) ||
      isNaN(appostaMaxima) ||
      saldoInicial < 1 ||
      apostaMinima < 1 ||
      apostaMaxima < apostaMinima
    ) {
      displayMessage(
        "Por favor, insira valores válidos para saldo e apostas.",
        true
      );
      return;
    }

    try {
      const response = await fetch("/api/init_game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saldo_inicial: saldoInicial,
          aposta_minima: apostaMinima,
          aposta_maxima: apostaMaxima,
        }),
      });
      const data = await response.json();
      if (data.success) {
        currentGameState.saldo = data.saldo;
        currentGameState.saldo_inicial_configurado = true;
        currentGameState.estrategia_ativa = "3"; // Reseta a estratégia no início
        currentGameState.aposta_base_martingale = 0.0;
        currentGameState.ultima_aposta_martingale = 0.0;
        currentGameState.perdeu_ultima_martingale = false;

        showSection("game-section");
        updateGameUI(currentGameState);
        clearMessages();
      } else {
        displayMessage("Erro ao iniciar jogo: " + data.message, true);
      }
    } catch (error) {
      displayMessage("Erro de conexão ao iniciar jogo.", true);
      console.error("Erro ao iniciar jogo:", error);
    }
  }

  async function playRound() {
    clearMessages();
    const aposta = parseFloat(betAmountInput.value);
    const manualCashout = parseFloat(manualCashoutInput.value) || 0.0;
    const autoCashout = parseFloat(autoCashoutInput.value) || 0.0;

    if (isNaN(aposta) || aposta <= 0) {
      displayMessage("Por favor, insira um valor de aposta válido.", true);
      return;
    }
    if (manualCashout > 0 && manualCashout <= 1.0) {
      displayMessage(
        "Saque manual deve ser maior que 1.0 ou 0 para desativar.",
        true
      );
      return;
    }
    if (autoCashout > 0 && autoCashout <= 1.0) {
      displayMessage(
        "Saque automático deve ser maior que 1.0 ou 0 para desativar.",
        true
      );
      return;
    }
    if (
      manualCashout === 0 &&
      autoCashout === 0 &&
      currentGameState.estrategia_ativa !== "2"
    ) {
      displayMessage(
        "Você deve configurar um saque manual ou automático (exceto na Martingale).",
        true
      );
      return;
    }

    try {
      playRoundBtn.disabled = true; // Desabilita botão enquanto a rodada está rodando
      displayMessage("✈️ Avião decolando... ✈️");

      const response = await fetch("/api/start_round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aposta: aposta,
          multiplicador_saque_manual: manualCashout,
          multiplicador_saque_automatico: autoCashout,
        }),
      });
      const data = await response.json();

      if (data.success) {
        currentGameState.saldo = data.saldo;
        currentGameState.perdeu_ultima_martingale = data.ganho_rodada < 0; // Atualiza estado da Martingale
        currentGameState.ultima_aposta_martingale =
          data.current_aposta_martingale; // Atualiza última aposta Martingale
        currentGameState.aposta_base_martingale =
          data.aposta_base_martingale ||
          currentGameState.aposta_base_martingale; // Atualiza base se necessário

        displayRoundResult(data);
        updateGameUI(currentGameState); // Atualiza saldo e estratégia Martingale no UI
      } else {
        displayMessage("Erro na rodada: " + data.message, true);
        if (data.message.includes("Game Over")) {
          playRoundBtn.disabled = true; // Desabilita o botão se o jogo acabar
          alert(
            "Seu saldo acabou ou não é suficiente para a estratégia. Fim de jogo!"
          );
          resetGameBtn.click(); // Reinicia o jogo
        }
      }
    } catch (error) {
      displayMessage("Erro de conexão ao jogar rodada.", true);
      console.error("Erro ao jogar rodada:", error);
    } finally {
      playRoundBtn.disabled = false; // Habilita o botão novamente
    }
  }

  async function fetchHistory() {
    try {
      const response = await fetch("/api/get_history");
      const data = await response.json();
      if (data.success) {
        historyListDiv.innerHTML = ""; // Limpa o histórico anterior
        if (data.historico.length === 0) {
          historyListDiv.innerHTML = "<p>Nenhuma rodada jogada ainda.</p>";
        } else {
          data.historico.forEach((round, index) => {
            const p = document.createElement("p");
            const multiplierSacado =
              round.multiplicador_sacado !== null
                ? `x${round.multiplicador_sacado.toFixed(2)}`
                : "N/A";
            const outcomeClass = round.ganho < 0 ? "lose" : "win";
            p.innerHTML = `Rodada ${
              index + 1
            }: Aposta: R$${round.aposta.toFixed(
              2
            )} | Sacado: ${multiplierSacado} | Final: x${round.multiplicador_final.toFixed(
              2
            )} | <span class="${outcomeClass}">${
              round.ganho > 0 ? "Ganho" : "Perda"
            } (R$${round.ganho.toFixed(2)})</span>`;
            historyListDiv.appendChild(p);
          });
        }
        showSection("history-section");
      } else {
        displayMessage("Erro ao carregar histórico: " + data.message, true);
      }
    } catch (error) {
      displayMessage("Erro de conexão ao carregar histórico.", true);
      console.error("Erro ao carregar histórico:", error);
    }
  }

  async function setStrategy(strategyCode) {
    try {
      const response = await fetch("/api/set_strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estrategia: strategyCode }),
      });
      const data = await response.json();
      if (data.success) {
        currentGameState.estrategia_ativa = data.estrategia_ativa;
        // Ao mudar a estratégia, o backend reseta o estado de Martingale.
        // O frontend também deve refletir isso.
        currentGameState.aposta_base_martingale = 0.0;
        currentGameState.ultima_aposta_martingale = 0.0;
        currentGameState.perdeu_ultima_martingale = false;

        updateGameUI(currentGameState);
        showSection("game-section");
        displayMessage(
          "Estratégia atualizada para " + getStrategyName(strategyCode)
        );
      } else {
        displayMessage("Erro ao definir estratégia: " + data.message, true);
      }
    } catch (error) {
      displayMessage("Erro de conexão ao definir estratégia.", true);
      console.error("Erro ao definir estratégia:", error);
    }
  }

  // --- Event Listeners ---

  configGameBtn.addEventListener("click", initGame);
  playRoundBtn.addEventListener("click", playRound);
  showHistoryBtn.addEventListener("click", fetchHistory);
  closeHistoryBtn.addEventListener("click", () => showSection("game-section"));
  changeStrategyBtn.addEventListener("click", () =>
    showSection("strategy-section")
  );
  cancelStrategyBtn.addEventListener("click", () =>
    showSection("game-section")
  );
  resetGameBtn.addEventListener("click", () => {
    // Redireciona a página para reiniciar o estado do backend
    location.reload();
  });

  strategyBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const strategy = btn.dataset.strategy;
      setStrategy(strategy);
    });
  });

  // Inicializa o estado do jogo ao carregar a página
  fetchGameState();
});
