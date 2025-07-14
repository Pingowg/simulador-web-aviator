from flask import Flask, render_template, request, jsonify
import random
import time
import os

app = Flask(__name__)

# --- Variáveis de Estado do Jogo (Simulando uma sessão de usuário para um único jogador) ---
# Em uma aplicação multiusuário real, isso seria gerenciado por sessões ou banco de dados.
game_state = {
    'saldo': 0.0,
    'saldo_inicial_configurado': False,
    'aposta_minima': 0.0,
    'aposta_maxima': 0.0,
    'historico_rodadas': [],
    'estrategia_ativa': '3', # '1': Manual, '2': Martingale, '3': Nenhuma
    'aposta_base_martingale': 0.0,
    'ultima_aposta_martingale': 0.0,
    'perdeu_ultima_martingale': False
}

# --- Funções de Lógica do Jogo ---
def gerar_multiplicador_final():
    rand_val = random.random()
    if rand_val < 0.7:
        return random.uniform(1.0, 2.5)
    elif rand_val < 0.95:
        return random.uniform(2.5, 7.0)
    else:
        return random.uniform(7.0, 50.0)

def calcular_resultado_rodada(aposta, multiplicador_final, saque_manual_alvo, saque_automatico_alvo):
    multiplicador_sacado = None
    ganho_rodada = 0
    mensagem = ""
    saque_realizado = False

    # Prioriza saque automático se configurado e atingido
    if saque_automatico_alvo > 1.0 and multiplicador_final >= saque_automatico_alvo:
        ganho = aposta * saque_automatico_alvo
        ganho_rodada = ganho - aposta
        multiplicador_sacado = saque_automatico_alvo
        mensagem = f"🎉 Saque automático realizado em x{multiplicador_sacado:.2f}! Você ganhou R${ganho:.2f}."
        saque_realizado = True
    # Senão, verifica saque manual se configurado e atingido
    elif saque_manual_alvo > 1.0 and multiplicador_final >= saque_manual_alvo:
        ganho = aposta * saque_manual_alvo
        ganho_rodada = ganho - aposta
        multiplicador_sacado = saque_manual_alvo
        mensagem = f"🎉 Você sacou manualmente em x{multiplicador_sacado:.2f}! Você ganhou R${ganho:.2f}."
        saque_realizado = True
    else:
        ganho_rodada = -aposta
        mensagem = f"😭 O avião voou antes de você sacar! Você perdeu R${aposta:.2f}."

    return {
        'ganho_rodada': ganho_rodada,
        'multiplicador_sacado': multiplicador_sacado,
        'mensagem': mensagem,
        'saque_realizado': saque_realizado
    }


# --- Rotas (Endpoints da API) ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/init_game', methods=['POST'])
def init_game():
    data = request.json
    try:
        saldo_inicial = float(data.get('saldo_inicial'))
        aposta_minima = float(data.get('aposta_minima'))
        aposta_maxima = float(data.get('aposta_maxima'))

        if saldo_inicial < 1 or aposta_minima < 1 or aposta_maxima < aposta_minima:
            return jsonify({'success': False, 'message': 'Valores de configuração inválidos.'}), 400

        game_state['saldo'] = saldo_inicial
        game_state['aposta_minima'] = aposta_minima
        game_state['aposta_maxima'] = aposta_maxima
        game_state['saldo_inicial_configurado'] = True
        game_state['historico_rodadas'] = []
        game_state['estrategia_ativa'] = '3' # Reseta para 'Nenhuma'
        game_state['aposta_base_martingale'] = 0.0
        game_state['ultima_aposta_martingale'] = 0.0
        game_state['perdeu_ultima_martingale'] = False

        # RETORNA TODOS OS DADOS NECESSÁRIOS PARA O FRONTEND
        return jsonify({
            'success': True,
            'saldo': game_state['saldo'],
            'estrategia_ativa': game_state['estrategia_ativa'],
            'aposta_minima': game_state['aposta_minima'],
            'aposta_maxima': game_state['aposta_maxima'],
            'saldo_inicial_configurado': game_state['saldo_inicial_configurado'],
            'perdeu_ultima_martingale': game_state['perdeu_ultima_martingale'],
            'aposta_base_martingale': game_state['aposta_base_martingale'],
            'ultima_aposta_martingale': game_state['ultima_aposta_martingale']
        }), 200
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Entrada inválida. Digite números.'}), 400

@app.route('/api/start_round', methods=['POST'])
def start_round():
    if not game_state['saldo_inicial_configurado']:
        return jsonify({'success': False, 'message': 'Configure o saldo inicial e os limites primeiro.'}), 400

    data = request.json
    aposta_solicitada = float(data.get('aposta'))
    saque_manual_alvo = float(data.get('multiplicador_saque_manual', 0.0))
    saque_automatico_alvo = float(data.get('multiplicador_saque_automatico', 0.0))

    aposta = aposta_solicitada # A aposta real pode ser ajustada pela estratégia

    # Lógica de aposta para Martingale
    if game_state['estrategia_ativa'] == '2':
        if game_state['perdeu_ultima_martingale']:
            aposta = game_state['ultima_aposta_martingale'] * 2
        else:
            aposta = game_state['aposta_base_martingale']

        # Ajustes de limites e saldo para Martingale
        if aposta > game_state['saldo']:
            aposta = game_state['saldo'] # Aposta o que resta
        if aposta < game_state['aposta_minima'] and game_state['saldo'] >= game_state['aposta_minima']:
            aposta = game_state['aposta_minima']
        elif aposta < game_state['aposta_minima'] and game_state['saldo'] < game_state['aposta_minima']:
             aposta = game_state['saldo'] # Aposta o que tem se for menos que o mínimo

        if aposta > game_state['aposta_maxima']:
            aposta = game_state['aposta_maxima']
        
        if aposta <= 0:
            return jsonify({'success': False, 'message': 'Saldo insuficiente para a aposta da estratégia Martingale. Game Over!'}), 400
        
        # A aposta base de martingale precisa ser definida quando a estrategia é selecionada ou na primeira aposta Martingale
        if game_state['aposta_base_martingale'] == 0.0:
            game_state['aposta_base_martingale'] = aposta_solicitada # Assume a primeira aposta manual como base

    # Validação geral da aposta (após ajustes de estratégia)
    if aposta <= 0 or aposta > game_state['saldo'] or \
       aposta < game_state['aposta_minima'] or aposta > game_state['aposta_maxima']:
        return jsonify({'success': False, 'message': f'Aposta inválida. Saldo: R${game_state["saldo"]:.2f}, Limites: R${game_state["aposta_minima"]:.2f} - R${game_state["aposta_maxima"]:.2f}. Aposta solicitada: R${aposta:.2f}'}), 400

    if saque_manual_alvo > 0 and saque_manual_alvo <= 1.0:
        return jsonify({'success': False, 'message': 'Multiplicador de saque manual deve ser > 1.0'}), 400
    if saque_automatico_alvo > 0 and saque_automatico_alvo <= 1.0:
        return jsonify({'success': False, 'message': 'Multiplicador de saque automático deve ser > 1.0'}), 400

    multiplicador_final = gerar_multiplicador_final()
    
    # Pequena pausa para simular processamento e dar um "respiro" na UX, não é um delay real de voo
    time.sleep(0.5)

    resultado = calcular_resultado_rodada(aposta, multiplicador_final, saque_manual_alvo, saque_automatico_alvo)

    game_state['saldo'] += resultado['ganho_rodada']

    # Atualiza estado para Martingale
    game_state['perdeu_ultima_martingale'] = not resultado['saque_realizado']
    if game_state['perdeu_ultima_martingale']:
        game_state['ultima_aposta_martingale'] = aposta
    else:
        game_state['ultima_aposta_martingale'] = 0 # Reseta se ganhou
        if game_state['aposta_base_martingale'] != 0:
            game_state['aposta_base_martingale'] = aposta_solicitada if game_state['estrategia_ativa'] == '2' and aposta_solicitada > 0 else game_state['aposta_base_martingale']

    game_state['historico_rodadas'].append({
        'aposta': aposta,
        'multiplicador_sacado': resultado['multiplicador_sacado'],
        'multiplicador_final': multiplicador_final,
        'ganho': resultado['ganho_rodada']
    })

    response_data = {
        'success': True,
        'saldo': game_state['saldo'],
        'multiplicador_final_voou': multiplicador_final,
        'multiplicador_sacado': resultado['multiplicador_sacado'],
        'mensagem': resultado['mensagem'],
        'ganho_rodada': resultado['ganho_rodada'],
        'estrategia_ativa': game_state['estrategia_ativa'],
        'aposta_minima': game_state['aposta_minima'],
        'aposta_maxima': game_state['aposta_maxima'],
        'saldo_inicial_configurado': game_state['saldo_inicial_configurado'],
        'perdeu_ultima_martingale': game_state['perdeu_ultima_martingale'],
        'aposta_base_martingale': game_state['aposta_base_martingale'],
        'ultima_aposta_martingale': game_state['ultima_aposta_martingale']
    }

    return jsonify(response_data)

@app.route('/api/get_history', methods=['GET'])
def get_history():
    return jsonify({'success': True, 'historico': game_state['historico_rodadas']})

@app.route('/api/get_game_state', methods=['GET'])
def get_game_state():
    return jsonify({
        'success': True,
        'saldo': game_state['saldo'],
        'estrategia_ativa': game_state['estrategia_ativa'],
        'aposta_minima': game_state['aposta_minima'],
        'aposta_maxima': game_state['aposta_maxima'],
        'saldo_inicial_configurado': game_state['saldo_inicial_configurado'],
        'perdeu_ultima_martingale': game_state['perdeu_ultima_martingale'],
        'aposta_base_martingale': game_state['aposta_base_martingale'],
        'ultima_aposta_martingale': game_state['ultima_aposta_martingale']
    })

@app.route('/api/set_strategy', methods=['POST'])
def set_strategy():
    data = request.json
    nova_estrategia = data.get('estrategia')

    if nova_estrategia in ['1', '2', '3']:
        game_state['estrategia_ativa'] = nova_estrategia
        # Reseta estados de Martingale ao mudar a estratégia
        game_state['aposta_base_martingale'] = 0.0
        game_state['ultima_aposta_martingale'] = 0.0
        game_state['perdeu_ultima_martingale'] = False
        return jsonify({'success': True, 'message': 'Estratégia atualizada', 'estrategia_ativa': nova_estrategia})
    else:
        return jsonify({'success': False, 'message': 'Estratégia inválida'}), 400

if __name__ == '__main__':
    app.run(debug=True)