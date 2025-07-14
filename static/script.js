// --- Elementos DOM ---
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
const cancelStrategyBtn = document.getElementById("cancelStrategyBtn");

// --- Funções Auxiliares ---

function formatCurrency(value) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function displayMessage(message, isError = false) {
  gameMessagePara.textContent = message;
  gameMessagePara.style.color = isError ? "red" : "inherit";
}

function updateGameUI(data) {
  currentBalanceSpan.textContent = formatCurrency(data.saldo);
  currentStrategySpan.textContent = getStrategyName(data.estrategia_ativa);
  betAmountInput.value =
    data.perdeu_ultima_martingale && data.ultima_aposta_martingale > 0
      ? (data.ultima_aposta_martingale * 2).toFixed(2)
      : data.aposta_base_martingale > 0
      ? data.aposta_base_martingale.toFixed(2)
      : data.aposta_minima.toFixed(2);
  betAmountInput.max = Math.min(data.saldo, data.aposta_maxima);
  betAmountInput.min = data.aposta_minima;

  if (data.saldo <= 0 || data.saldo < data.aposta_minima) {
    playRoundBtn.disabled = true;
    displayMessage("Saldo insuficiente para continuar. Reinicie o jogo.", true);
  } else {
    playRoundBtn.disabled = false;
  }
}

function getStrategyName(id) {
  switch (id) {
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

// --- Funções de Requisição à API (Backend Flask) ---

async function initGame() {
  const saldoInicial = parseFloat(saldoInicialInput.value);
  const apostaMinima = parseFloat(apostaMinimaInput.value);
  const apostaMaxima = parseFloat(apostaMaximaInput.value);

  if (
    isNaN(saldoInicial) ||
    isNaN(apostaMinima) ||
    isNaN(apostaMaxima) ||
    saldoInicial <= 0 ||
    apostaMinima <= 0 ||
    apostaMaxima <= 0 ||
    apostaMinima > apostaMaxima
  ) {
    displayMessage(
      "Por favor, insira valores válidos e positivos para Saldo, Aposta Mínima e Aposta Máxima (Mínima deve ser menor ou igual à Máxima).",
      true
    );
    return;
  }

  try {
    const response = await fetch("/api/init_game", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        saldo_inicial: saldoInicial,
        aposta_minima: apostaMinima,
        aposta_maxima: apostaMaxima,
      }),
    });
    const data = await response.json();

    if (data.success) {
      displayMessage("Jogo inicializado com sucesso!");
      updateGameUI(data); // Agora 'data' contém todas as propriedades necessárias do backend
      configSection.style.display = "none";
      gameSection.style.display = "block";
    } else {
      displayMessage(`Erro ao inicializar: ${data.message}`, true);
    }
  } catch (error) {
    console.error("Erro na requisição de inicialização:", error);
    displayMessage(
      "Erro ao conectar com o servidor para inicializar o jogo.",
      true
    );
  }
}

async function startGameRound() {
  const aposta = parseFloat(betAmountInput.value);
  const saqueManual = parseFloat(manualCashoutInput.value);
  const saqueAutomatico = parseFloat(autoCashoutInput.value);

  if (isNaN(aposta) || aposta <= 0) {
    displayMessage("Por favor, insira um valor de aposta válido.", true);
    return;
  }

  if (saqueManual > 0 && saqueManual <= 1) {
    displayMessage(
      "Multiplicador de saque manual deve ser maior que 1.0",
      true
    );
    return;
  }
  if (saqueAutomatico > 0 && saqueAutomatico <= 1 && saqueAutomatico !== 0) {
    displayMessage(
      "Multiplicador de saque automático deve ser maior que 1.0 (ou 0 para desativar).",
      true
    );
    return;
  }

  playRoundBtn.disabled = true;
  displayMessage("Avião voando...", false);
  roundResultPara.textContent = "";

  try {
    const response = await fetch("/api/start_round", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aposta: aposta,
        multiplicador_saque_manual: saqueManual,
        multiplicador_saque_automatico: saqueAutomatico,
      }),
    });
    const data = await response.json();

    if (data.success) {
      updateGameUI(data);
      let resultMessage = data.mensagem;

      if (data.multiplicador_sacado) {
        resultMessage += ` Multiplicador final da rodada: x${data.multiplicador_final_voou.toFixed(
          2
        )}.`;
      } else {
        resultMessage += ` O avião voou até x${data.multiplicador_final_voou.toFixed(
          2
        )}.`;
      }
      displayMessage(resultMessage);
      roundResultPara.textContent = `Ganho/Perda na rodada: ${formatCurrency(
        data.ganho_rodada
      )}`;
    } else {
      displayMessage(`Erro na rodada: ${data.message}`, true);
    }
  } catch (error) {
    console.error("Erro na requisição da rodada:", error);
    displayMessage(
      "Erro ao conectar com o servidor para jogar a rodada.",
      true
    );
  } finally {
    playRoundBtn.disabled = false;
  }
}

async function getHistory() {
  try {
    const response = await fetch("/api/get_history");
    const data = await response.json();

    if (data.success) {
      historyListDiv.innerHTML = "";
      if (data.historico.length === 0) {
        historyListDiv.innerHTML = "<p>Nenhuma rodada jogada ainda.</p>";
      } else {
        data.historico.forEach((round, index) => {
          const p = document.createElement("p");
          p.textContent = `Rodada ${index + 1}: Aposta ${formatCurrency(
            round.aposta
          )}, Multiplicador Final: x${round.multiplicador_final.toFixed(2)}`;
          if (round.multiplicador_sacado) {
            p.textContent += `, Sacou em x${round.multiplicador_sacado.toFixed(
              2
            )}`;
          }
          p.textContent += `, Ganho/Perda: ${formatCurrency(round.ganho)}.`;
          historyListDiv.appendChild(p);
        });
      }
      gameSection.style.display = "none";
      historySection.style.display = "block";
    } else {
      displayMessage(`Erro ao buscar histórico: ${data.message}`, true);
    }
  } catch (error) {
    console.error("Erro na requisição do histórico:", error);
    displayMessage(
      "Erro ao conectar com o servidor para buscar histórico.",
      true
    );
  }
}

async function setStrategy(strategyId) {
  try {
    const response = await fetch("/api/set_strategy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ estrategia: strategyId }),
    });
    const data = await response.json();

    if (data.success) {
      displayMessage(
        `Estratégia alterada para: ${getStrategyName(data.estrategia_ativa)}`
      );
      currentStrategySpan.textContent = getStrategyName(data.estrategia_ativa);
      strategySection.style.display = "none";
      gameSection.style.display = "block";
      fetchGameState();
    } else {
      displayMessage(`Erro ao mudar estratégia: ${data.message}`, true);
    }
  } catch (error) {
    console.error("Erro na requisição de estratégia:", error);
    displayMessage(
      "Erro ao conectar com o servidor para mudar estratégia.",
      true
    );
  }
}

async function fetchGameState() {
  try {
    const response = await fetch("/api/get_game_state");
    const data = await response.json();
    if (data.success) {
      if (!data.saldo_inicial_configurado) {
        configSection.style.display = "block";
        gameSection.style.display = "none";
        historySection.style.display = "none";
        strategySection.style.display = "none";
      } else {
        updateGameUI(data);
        configSection.style.display = "none";
        gameSection.style.display = "block";
      }
    } else {
      console.error("Erro ao buscar estado do jogo:", data.message);
      configSection.style.display = "block";
      gameSection.style.display = "none";
    }
  } catch (error) {
    console.error("Erro na requisição para get_game_state:", error);
    configSection.style.display = "block";
    gameSection.style.display = "none";
  }
}

// --- Listeners de Eventos ---

document.addEventListener("DOMContentLoaded", () => {
  fetchGameState();

  configGameBtn.addEventListener("click", initGame);
  playRoundBtn.addEventListener("click", startGameRound);
  showHistoryBtn.addEventListener("click", getHistory);
  changeStrategyBtn.addEventListener("click", () => {
    gameSection.style.display = "none";
    strategySection.style.display = "block";
  });
  resetGameBtn.addEventListener("click", () => {
    window.location.reload();
  });
  closeHistoryBtn.addEventListener("click", () => {
    historySection.style.display = "none";
    gameSection.style.display = "block";
  });
  cancelStrategyBtn.addEventListener("click", () => {
    strategySection.style.display = "none";
    gameSection.style.display = "block";
  });

  document.querySelectorAll(".strategy-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const strategy = event.target.dataset.strategy;
      setStrategy(strategy);
    });
  });
});
