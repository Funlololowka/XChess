
import { Injectable, signal, computed } from '@angular/core';
import { Chess, Move } from 'chess.js';
import { GoogleGenAI } from "@google/genai";

declare var Peer: any; 

export interface Player {
  name: string;
  wins: number;
  password?: string; // Сохраняем пароль
}

@Injectable({
  providedIn: 'root'
})
export class ChessEngineService {
  private game = new Chess();
  private ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
  
  // Timers
  private aiTimeout: any = null;

  // PeerJS State
  private peer: any;
  private conn: any;
  peerId = signal<string | null>(null);
  isConnected = signal(false);
  isHost = signal(false); 
  
  // Game State
  fen = signal(this.game.fen());
  difficulty = signal('medium');
  gameMode = signal<'bot' | 'multiplayer'>('bot');
  isThinking = signal(false);
  isSearching = signal(false); 
  lastMove = signal<Move | null>(null);
  
  // Специальный статус для окончания игры
  customStatus = signal<string | null>(null);

  // User & Data
  currentUser = signal<Player>({ name: 'Гость', wins: 0 });
  allUsers = signal<Player[]>([]);

  constructor() {
    this.loadDatabase();
    this.restoreSession();
  }

  // --- Auth & Database Logic ---
  
  private loadDatabase() {
    const db = localStorage.getItem('xchess_db');
    if (db) {
      try {
        this.allUsers.set(JSON.parse(db));
      } catch {
        this.allUsers.set([]);
      }
    }
  }

  private saveDatabase() {
    localStorage.setItem('xchess_db', JSON.stringify(this.allUsers()));
  }

  private restoreSession() {
    const sessionUser = localStorage.getItem('xchess_session');
    if (sessionUser) {
      const user = this.allUsers().find(u => u.name === sessionUser);
      if (user) {
        this.currentUser.set(user);
      } else {
        localStorage.removeItem('xchess_session');
      }
    }
  }

  register(name: string, password: string): { success: boolean, message: string } {
    if (this.allUsers().find(u => u.name === name)) {
      return { success: false, message: 'Имя уже занято!' };
    }

    const newUser: Player = { name, password, wins: 0 };
    this.allUsers.update(users => [...users, newUser]);
    this.saveDatabase();
    
    this.login(name, password);
    return { success: true, message: '' };
  }

  login(name: string, password: string): { success: boolean, message: string } {
    const user = this.allUsers().find(u => u.name === name);
    
    if (!user) {
      return { success: false, message: 'Пользователь не найден' };
    }
    
    if (user.password !== password) {
      return { success: false, message: 'Неверный пароль' };
    }

    this.currentUser.set(user);
    localStorage.setItem('xchess_session', user.name);
    return { success: true, message: '' };
  }

  logout() {
    this.currentUser.set({ name: 'Гость', wins: 0 });
    localStorage.removeItem('xchess_session');
  }

  private recordWin() {
    const current = this.currentUser();
    if (current.name === 'Гость') return;

    this.allUsers.update(users => {
      return users.map(u => {
        if (u.name === current.name) {
          return { ...u, wins: u.wins + 1 };
        }
        return u;
      });
    });
    this.saveDatabase();

    const updatedUser = this.allUsers().find(u => u.name === current.name);
    if (updatedUser) this.currentUser.set(updatedUser);
  }

  getLeaderboardDisplay() {
    return [...this.allUsers()].sort((a, b) => b.wins - a.wins);
  }

  // --- Game Views ---
  board = computed(() => {
    this.fen();
    return this.game.board();
  });

  history = computed(() => {
    this.fen();
    return this.game.history();
  });

  status = computed(() => {
    const custom = this.customStatus();
    if (custom) return custom;

    this.fen(); 
    
    if (this.game.isCheckmate()) return 'Checkmate!';
    if (this.game.isDraw()) return 'Draw';
    if (this.game.isCheck()) return 'Check!';
    return 'playing';
  });

  turn = computed(() => {
    this.fen();
    return this.game.turn();
  });

  isBoardFlipped = computed(() => {
    return this.gameMode() === 'multiplayer' && this.isConnected() && !this.isHost();
  });

  canMove = computed(() => {
    if (this.customStatus()) return false;
    if (this.game.isGameOver()) return false;

    if (this.gameMode() === 'bot') return !this.isThinking() && this.game.turn() === 'w';
    if (this.gameMode() === 'multiplayer') {
      if (!this.isConnected()) return false;
      const myColor = this.isHost() ? 'w' : 'b';
      return this.game.turn() === myColor;
    }
    return true;
  });

  // --- Actions ---

  setDifficulty(level: string) {
    this.difficulty.set(level);
  }

  setGameMode(mode: 'bot' | 'multiplayer') {
    this.gameMode.set(mode);
    this.reset();
    
    if (mode === 'multiplayer') {
      this.initPeer();
    } else {
      this.destroyPeer();
    }
  }

  reset() {
    this.game.reset();
    this.lastMove.set(null);
    this.customStatus.set(null);
    this.fen.set(this.game.fen());
    clearTimeout(this.aiTimeout);
    this.isThinking.set(false);
  }

  resign() {
    if (this.customStatus() || (this.game.isGameOver() && !this.customStatus())) return;

    // Сброс таймеров, чтобы бот не походил после сдачи
    clearTimeout(this.aiTimeout);
    this.isThinking.set(false);

    if (this.gameMode() === 'bot') {
      this.customStatus.set('Вы сдались. Бот победил.');
    } else if (this.gameMode() === 'multiplayer') {
      if (this.conn && this.isConnected()) {
        this.conn.send({ type: 'resign' });
      }
      this.customStatus.set('Вы сдались.');
    }
    // Force UI update
    this.fen.set(this.game.fen());
  }

  getMovesForSquare(square: string) {
    if (!this.canMove()) return [];
    return this.game.moves({ square: square as any, verbose: true });
  }

  makeMove(moveData: { from: string, to: string, promotion?: string }) {
    if (!this.canMove()) return;

    try {
      const move = this.game.move({
        from: moveData.from,
        to: moveData.to,
        promotion: moveData.promotion || 'q'
      });

      if (move) {
        this.updateGameState(move);

        if (this.gameMode() === 'bot') {
          if (!this.game.isGameOver()) {
            // Сохраняем ID таймера, чтобы можно было отменить при сдаче
            this.aiTimeout = setTimeout(() => this.triggerAiMove(), 400);
          } else {
            this.checkWinCondition();
          }
        } else if (this.gameMode() === 'multiplayer' && this.conn) {
          this.conn.send({ type: 'move', from: moveData.from, to: moveData.to, promotion: moveData.promotion });
          this.checkWinCondition();
        }
      }
    } catch (e) {
      console.error('Неверный ход', e);
    }
  }

  private updateGameState(move: Move) {
    this.lastMove.set(move);
    this.fen.set(this.game.fen());
  }

  private checkWinCondition() {
    if (this.game.isCheckmate()) {
       const winner = this.game.turn() === 'w' ? 'b' : 'w'; 
       
       if (this.gameMode() === 'bot') {
         if (winner === 'w') this.recordWin();
       } else {
         const amIWhite = this.isHost();
         const amIWinner = (winner === 'w' && amIWhite) || (winner === 'b' && !amIWhite);
         if (amIWinner) this.recordWin();
       }
    }
  }

  // --- AI ---
  private async triggerAiMove() {
    // Двойная проверка, не сдался ли игрок за время задержки
    if (this.isThinking() || this.customStatus()) return;
    this.isThinking.set(true);

    try {
      const diff = this.difficulty();
      let config: any = {
        model: 'gemini-2.5-flash',
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: ""
      };

      switch(diff) {
        case 'easy':
          config.systemInstruction = "Вы — имитация Gemini 2.0 Flash Lite. Новичок. Отвечайте ТОЛЬКО в формате SAN.";
          break;
        case 'medium':
          config.systemInstruction = "Вы — имитация Gemini 2.0 Flash Lite. Средний игрок. Отвечайте ТОЛЬКО в формате SAN.";
          break;
        case 'hard':
          config.systemInstruction = "Вы — имитация Gemini 2.5 Flash Lite. Мастер. Отвечайте ТОЛЬКО в формате SAN.";
          break;
        case 'insane':
          delete config.thinkingConfig;
          config.systemInstruction = "Вы — Gemini 2.5 Flash. Гроссмейстер. Победа любой ценой. Отвечайте ТОЛЬКО в формате SAN.";
          break;
      }

      const prompt = `FEN: ${this.game.fen()}. Вы за черных. Сделайте лучший ход.`;
      
      const response = await this.ai.models.generateContent({
        model: config.model,
        contents: prompt,
        config: {
          systemInstruction: config.systemInstruction,
          thinkingConfig: config.thinkingConfig,
          temperature: (diff === 'easy') ? 0.9 : 0.1,
        }
      });

      // Еще одна проверка перед применением хода
      if (this.customStatus()) return;

      const aiMoveStr = response.text.trim().split(' ').pop()?.replace(/[^a-zA-Z0-9+#=]/g, '') || '';
      
      try {
        const move = this.game.move(aiMoveStr);
        if (move) {
          this.updateGameState(move);
          this.checkWinCondition();
        }
      } catch {
        const moves = this.game.moves();
        if (moves.length > 0) {
          const m = this.game.move(moves[Math.floor(Math.random() * moves.length)]);
          if (m) {
            this.updateGameState(m);
            this.checkWinCondition();
          }
        }
      }
    } catch (error) {
       // Silent fail
    } finally {
      this.isThinking.set(false);
      this.fen.set(this.game.fen());
    }
  }

  // --- Multiplayer ---
  private initPeer() {
    this.isSearching.set(true);
    this.peer = new Peer(null, { debug: 1 });

    this.peer.on('open', (id: string) => {
      this.peerId.set(id);
    });

    this.peer.on('connection', (conn: any) => {
      this.handleConnection(conn, true); 
    });

    this.peer.on('error', (err: any) => {
      this.isSearching.set(false);
    });
  }

  joinGame(hostId: string) {
    if (!this.peer) {
      this.peer = new Peer(null, { debug: 1 });
      this.peer.on('open', () => {
        const conn = this.peer.connect(hostId);
        this.handleConnection(conn, false); 
      });
    } else {
      const conn = this.peer.connect(hostId);
      this.handleConnection(conn, false);
    }
  }

  private handleConnection(conn: any, amIHost: boolean) {
    this.conn = conn;
    this.isHost.set(amIHost);
    
    conn.on('open', () => {
      this.isConnected.set(true);
      this.isSearching.set(false);
      this.reset(); 
    });

    conn.on('data', (data: any) => {
      if (data.type === 'move') {
        const move = this.game.move({
          from: data.from,
          to: data.to,
          promotion: data.promotion || 'q'
        });
        if (move) {
          this.updateGameState(move);
          this.checkWinCondition();
        }
      } else if (data.type === 'resign') {
        this.customStatus.set('Соперник сдался! Вы победили.');
        this.recordWin();
      }
    });

    conn.on('close', () => {
      alert('Соперник отключился');
      this.isConnected.set(false);
      this.setGameMode('bot');
    });
  }

  private destroyPeer() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.peerId.set(null);
    this.isConnected.set(false);
  }
}
