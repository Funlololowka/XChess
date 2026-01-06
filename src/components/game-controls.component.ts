
import { Component, input, output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChessEngineService } from '../services/chess-engine.service';

@Component({
  selector: 'app-game-controls',
  imports: [CommonModule],
  template: `
    <div class="bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white/5 shadow-2xl flex flex-col gap-8 animate-fade-in">
      <!-- Режим игры -->
      <div class="space-y-4">
        <label class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Тип матча</label>
        <div class="grid grid-cols-2 gap-3">
          <button 
            (click)="modeChange.emit('bot')"
            [class]="gameMode() === 'bot' ? 'bg-white text-slate-950 scale-105' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'"
            class="px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 border border-transparent shadow-lg">
            🤖 БОТ
          </button>
          <button 
            (click)="modeChange.emit('multiplayer')"
            [class]="gameMode() === 'multiplayer' ? 'bg-indigo-600 text-white scale-105 shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'"
            class="px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 border border-transparent">
            🌐 СЕТЬ
          </button>
        </div>
      </div>

      @if (gameMode() === 'bot') {
        <div class="space-y-4">
          <label class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Интеллект Gemini</label>
          <div class="grid grid-cols-2 gap-2">
            @for (lvl of levels; track lvl.id) {
              <button 
                (click)="difficultyChange.emit(lvl.id)"
                [class]="difficulty() === lvl.id ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'"
                class="px-3 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">
                {{ lvl.label }}
              </button>
            }
          </div>
        </div>
      } @else {
        <div class="p-5 rounded-2xl border space-y-3 transition-colors"
             [class.bg-emerald-500-10]="isConnected()"
             [class.border-emerald-500-20]="isConnected()"
             [class.bg-indigo-500-10]="!isConnected()"
             [class.border-indigo-500-20]="!isConnected()">
          
          <div class="flex justify-between items-start">
            <p class="text-[10px] font-bold uppercase tracking-widest leading-relaxed" 
               [class.text-emerald-300]="isConnected()"
               [class.text-indigo-300]="!isConnected()">
              {{ isConnected() ? 'Соединение установлено' : 'P2P Лобби' }}
            </p>
            <div class="w-2 h-2 rounded-full animate-pulse" 
                 [class.bg-emerald-400]="isConnected()" 
                 [class.bg-yellow-400]="!isConnected()"></div>
          </div>

          @if(isConnected()) {
             <p class="text-xs text-slate-300">
               Вы играете за <span class="font-bold text-white">{{ amIHost() ? 'БЕЛЫХ' : 'ЧЕРНЫХ' }}</span>
             </p>
          } @else {
             <p class="text-xs text-slate-400">Ожидание подключения игрока...</p>
          }
        </div>
      }

      <div class="h-px bg-white/5"></div>

      <div class="space-y-4">
        <label class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Текущий статус</label>
        <div class="p-5 rounded-2xl bg-slate-950 border border-white/5 shadow-inner">
          @if (isActiveGame()) {
             <div class="flex items-center justify-between">
               <span class="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                 {{ status() === 'Check!' ? '🔥 ШАХ!' : 'В ПРОЦЕССЕ' }}
               </span>
               <div class="flex gap-1">
                 <div class="w-1 h-3 bg-emerald-500/30 rounded-full animate-pulse"></div>
                 <div class="w-1 h-3 bg-emerald-500/50 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                 <div class="w-1 h-3 bg-emerald-500/70 rounded-full animate-pulse [animation-delay:0.4s]"></div>
               </div>
             </div>
          } @else {
             <div class="text-white text-md font-black uppercase italic tracking-tighter text-center leading-tight">
               {{ translateStatus(status()) }}
             </div>
          }
        </div>
      </div>

      <div class="grid gap-3">
        <button 
          (click)="reset.emit()"
          [disabled]="isThinking() || (gameMode() === 'multiplayer' && !isConnected())"
          class="group relative overflow-hidden py-4 bg-white hover:bg-slate-100 text-slate-950 font-black rounded-xl transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] text-xs">
          <span class="relative z-10">Новая партия</span>
        </button>

        <!-- Resign Button: Active when playing OR when in check -->
        @if (isActiveGame()) {
          <button 
            (click)="onResign()"
            class="py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl transition-all border border-red-500/30 uppercase tracking-[0.2em] text-xs active:scale-95">
            🏳️ Сдаться
          </button>
        }
      </div>
    </div>
  `
})
export class GameControlsComponent {
  private engine = inject(ChessEngineService);
  
  difficulty = input.required<string>();
  gameMode = input.required<'bot' | 'multiplayer'>();
  status = input.required<string>();
  isThinking = input.required<boolean>();
  
  modeChange = output<'bot' | 'multiplayer'>();
  difficultyChange = output<string>();
  reset = output<void>();

  isConnected = computed(() => this.engine.isConnected());
  amIHost = computed(() => this.engine.isHost());

  // Вычисляем, активна ли игра (для показа кнопки "Сдаться")
  isActiveGame = computed(() => {
    const s = this.status();
    return s === 'playing' || s === 'Check!';
  });

  levels = [
    { id: 'easy', label: 'Легко' },
    { id: 'medium', label: 'Средне' },
    { id: 'hard', label: 'Сложно' },
    { id: 'insane', label: 'Безумно' }
  ];

  translateStatus(status: string): string {
    const map: Record<string, string> = {
      'Checkmate!': 'ШАХ И МАТ',
      'Draw': 'НИЧЬЯ',
      'Check!': 'ШАХ',
      'playing': 'ИГРАЕМ'
    };
    // Если статус нестандартный (например, "Вы сдались"), возвращаем его как есть
    return map[status] || status;
  }

  onResign() {
    if (confirm('Вы уверены, что хотите сдаться?')) {
      this.engine.resign();
    }
  }
}
