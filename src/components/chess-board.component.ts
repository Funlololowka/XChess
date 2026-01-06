
import { Component, input, output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChessEngineService } from '../services/chess-engine.service';

@Component({
  selector: 'app-chess-board',
  imports: [CommonModule],
  template: `
    <div class="relative w-full aspect-square bg-slate-900 rounded-lg overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-8 border-slate-900">
      <!-- Grid Layout -->
      <div class="grid grid-cols-8 grid-rows-8 w-full h-full transition-transform duration-700"
           [class.rotate-180-safe]="isFlipped()">
        
        @for (row of rows; track row) {
          @for (col of cols; track col) {
            <div 
              [class]="getSquareClass(col, row)"
              (click)="handleSquareClick(col, row)"
              class="relative flex items-center justify-center cursor-pointer">
              
              <!-- Coordinates -->
              @if (col === 'a') {
                <span class="absolute top-0.5 left-1 text-[9px] font-black opacity-30 select-none uppercase"
                      [class.rotate-180-safe]="isFlipped()">{{ row }}</span>
              }
              @if (row === 1) {
                <span class="absolute bottom-0.5 right-1 text-[9px] font-black opacity-30 select-none uppercase"
                      [class.rotate-180-safe]="isFlipped()">{{ col }}</span>
              }

              <!-- Piece SVG -->
              @if (getPiece(col, row); as piece) {
                <img 
                  [src]="getPieceSvg(piece.type, piece.color)" 
                  [alt]="piece.type"
                  class="chess-piece-img z-10 select-none pointer-events-none"
                  [class.piece-white-style]="piece.color === 'w'"
                  [class.piece-black-style]="piece.color === 'b'"
                  [class.opacity-40]="isThinking() && piece.color === 'b'"
                  [class.rotate-180-safe]="isFlipped()">
              }

              <!-- Legal Move Dot -->
              @if (isValidMove(col, row)) {
                <div class="absolute w-1/4 h-1/4 rounded-full bg-emerald-500/60 ring-4 ring-emerald-500/20 z-20"></div>
              }
            </div>
          }
        }
      </div>

      <!-- Overlays -->
      @if (isThinking()) {
        <div class="absolute inset-0 bg-slate-950/10 backdrop-blur-[1px] flex items-center justify-center z-40 pointer-events-none">
          <div class="bg-slate-950/90 px-8 py-4 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-4 animate-fade-in">
             <div class="flex gap-1">
               <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
               <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
               <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
             </div>
             <span class="text-xs font-black tracking-[0.2em] text-white uppercase">Анализ Gemini</span>
          </div>
        </div>
      }
    </div>
  `,
  host: {
    'class': 'block w-full max-w-[640px] mx-auto'
  }
})
export class ChessBoardComponent {
  private engine = inject(ChessEngineService);
  
  isThinking = input<boolean>(false);
  moveMade = output<{ from: string, to: string }>();

  isFlipped = computed(() => this.engine.isBoardFlipped());

  rows = [8, 7, 6, 5, 4, 3, 2, 1];
  cols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  selectedSquare = signal<string | null>(null);

  getPiece(col: string, row: number) {
    const rIdx = 8 - row;
    const cIdx = col.charCodeAt(0) - 97;
    const board = this.engine.board();
    return board[rIdx] ? board[rIdx][cIdx] : null;
  }

  getPieceSvg(type: string, color: string): string {
    const c = color === 'w' ? 'w' : 'b';
    const t = type.toUpperCase();
    return `https://upload.wikimedia.org/wikipedia/commons/${this.getPieceUrlPart(t, c)}.svg`;
  }

  private getPieceUrlPart(type: string, color: string): string {
    const map: Record<string, string> = {
      'WK': '4/42/Chess_klt45', 'WQ': '1/15/Chess_qlt45', 'WR': '7/72/Chess_rlt45', 'WB': 'b/b1/Chess_blt45', 'WN': '7/70/Chess_nlt45', 'WP': '4/45/Chess_plt45',
      'BK': 'f/f0/Chess_kdt45', 'BQ': '4/47/Chess_qdt45', 'BR': 'f/ff/Chess_rdt45', 'BB': '9/98/Chess_bdt45', 'BN': 'e/ef/Chess_ndt45', 'BP': 'c/c7/Chess_pdt45'
    };
    return map[color.toUpperCase() + type];
  }

  getSquareClass(col: string, row: number) {
    const isDark = (this.cols.indexOf(col) + row) % 2 === 0;
    const square = col + row;
    const isSelected = this.selectedSquare() === square;
    const isLastMove = this.engine.lastMove()?.from === square || this.engine.lastMove()?.to === square;
    
    return {
      'square-dark': isDark,
      'square-light': !isDark,
      'ring-inset ring-[6px] ring-blue-500/80 z-30': isSelected,
      'square-last-move': isLastMove && !isSelected
    };
  }

  isValidMove(col: string, row: number) {
    if (!this.selectedSquare()) return false;
    const target = col + row;
    const moves = this.engine.getMovesForSquare(this.selectedSquare()!);
    return moves.some(m => m.to === target);
  }

  handleSquareClick(col: string, row: number) {
    if (!this.engine.canMove()) return;

    const square = col + row;
    const piece = this.getPiece(col, row);

    if (this.selectedSquare()) {
      const moves = this.engine.getMovesForSquare(this.selectedSquare()!);
      const move = moves.find(m => m.to === square);
      
      if (move) {
        this.moveMade.emit({ from: this.selectedSquare()!, to: square });
        this.selectedSquare.set(null);
        return;
      }
    }

    if (piece && piece.color === this.engine.turn()) {
      this.selectedSquare.set(square);
    } else {
      this.selectedSquare.set(null);
    }
  }
}
