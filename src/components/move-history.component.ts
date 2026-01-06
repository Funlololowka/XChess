
import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-move-history',
  imports: [CommonModule],
  template: `
    <div class="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl flex flex-col h-[400px] animate-fade-in overflow-hidden">
      <div class="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h3 class="text-xs font-semibold uppercase tracking-widest text-slate-500">Журнал ходов</h3>
        <span class="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono tracking-tighter italic">LIVE PGN</span>
      </div>
      
      <!-- Table Headers -->
      <div class="grid grid-cols-2 bg-slate-950 border-b border-slate-800">
        <div class="p-2 text-[9px] uppercase font-black text-slate-500 text-center border-r border-slate-800 tracking-widest">Вы (Белые)</div>
        <div class="p-2 text-[9px] uppercase font-black text-slate-500 text-center tracking-widest">Оппонент (Черные)</div>
      </div>

      <div class="flex-1 overflow-y-auto p-0 scrollbar-hide">
        @if (history().length === 0) {
          <div class="h-full flex flex-col items-center justify-center opacity-30 italic text-xs">
            <span class="mb-1">♟️</span>
            <span>Матч еще не начат</span>
          </div>
        } @else {
          <div class="grid grid-cols-2">
            @for (movePair of movePairs; track movePair.index) {
              <div class="contents">
                <!-- White Move (User) -->
                <div class="p-3 border-b border-r border-slate-800 hover:bg-white/5 transition-colors flex items-center justify-between group">
                  <div class="flex items-center gap-2">
                    <span class="text-[9px] font-mono text-slate-700">{{ movePair.index }}</span>
                    <span class="font-mono text-sm font-bold text-slate-100">{{ movePair.white }}</span>
                  </div>
                  <span class="text-[8px] font-bold text-slate-700 uppercase opacity-0 group-hover:opacity-100 transition-opacity">ВЫ</span>
                </div>
                
                <!-- Black Move (Opponent) -->
                <div class="p-3 border-b border-slate-800 hover:bg-white/5 transition-colors flex items-center justify-between group">
                  @if (movePair.black) {
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-sm font-bold text-blue-400">{{ movePair.black }}</span>
                    </div>
                    <span class="text-[8px] font-bold text-blue-900 uppercase opacity-0 group-hover:opacity-100 transition-opacity">ИИ</span>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class MoveHistoryComponent {
  history = input.required<string[]>();

  get movePairs() {
    const hist = this.history();
    const pairs = [];
    for (let i = 0; i < hist.length; i += 2) {
      pairs.push({
        index: Math.floor(i / 2) + 1,
        white: hist[i],
        black: hist[i + 1] || null
      });
    }
    return pairs;
  }
}
