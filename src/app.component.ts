
import { Component, signal, computed, inject, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChessBoardComponent } from './components/chess-board.component';
import { MoveHistoryComponent } from './components/move-history.component';
import { GameControlsComponent } from './components/game-controls.component';
import { ChessEngineService } from './services/chess-engine.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ChessBoardComponent, MoveHistoryComponent, GameControlsComponent, FormsModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  engine = inject(ChessEngineService);

  @ViewChild('leaderboardDialog') leaderboardDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('authDialog') authDialog!: ElementRef<HTMLDialogElement>;

  gameStatus = computed(() => this.engine.status());
  difficulty = computed(() => this.engine.difficulty());
  isThinking = computed(() => this.engine.isThinking());
  history = computed(() => this.engine.history());
  turn = computed(() => this.engine.turn());
  gameMode = computed(() => this.engine.gameMode());
  isSearching = computed(() => this.engine.isSearching());
  
  peerId = computed(() => this.engine.peerId());
  isConnected = computed(() => this.engine.isConnected());

  // User state
  currentUser = computed(() => this.engine.currentUser());
  leaderboardData = computed(() => this.engine.getLeaderboardDisplay());

  // Auth Form
  authMode = signal<'login' | 'register'>('login');
  authName = '';
  authPassword = '';
  authError = signal('');

  ngOnInit() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const room = urlParams.get('room');
      if (room) {
        this.engine.setGameMode('multiplayer');
        this.engine.joinGame(room);
      }
    } catch (e) {
      console.warn('Ошибка чтения параметров URL:', e);
    }
  }

  onMove(move: { from: string, to: string, promotion?: string }) {
    this.engine.makeMove(move);
  }

  onReset() {
    this.engine.reset();
  }

  onDifficultyChange(level: string) {
    this.engine.setDifficulty(level);
  }

  onModeChange(mode: 'bot' | 'multiplayer') {
    this.engine.setGameMode(mode);
    if (mode === 'bot') {
       try {
         // Пытаемся очистить URL от параметров комнаты.
         // В blob/iframe окружениях это может вызвать ошибку, которую мы подавляем.
         window.history.pushState({}, '', window.location.pathname);
       } catch (e) {
         console.warn('Не удалось обновить URL (это нормально в режиме предпросмотра):', e);
       }
    }
  }

  copyLink() {
    const id = this.peerId();
    if (!id) return;
    try {
      const link = `${window.location.origin}${window.location.pathname}?room=${id}`;
      navigator.clipboard.writeText(link).then(() => {
        alert('Ссылка скопирована! Отправьте её другу.');
      });
    } catch (e) {
      alert('Не удалось скопировать ссылку в данном окружении.');
    }
  }

  // UI Actions
  openLeaderboard() {
    this.leaderboardDialog.nativeElement.showModal();
  }
  closeLeaderboard() {
    this.leaderboardDialog.nativeElement.close();
  }

  openAuth() {
    this.authName = '';
    this.authPassword = '';
    this.authError.set('');
    this.authMode.set('login');
    this.authDialog.nativeElement.showModal();
  }
  
  closeAuth() {
    this.authDialog.nativeElement.close();
  }

  toggleAuthMode() {
    this.authMode.set(this.authMode() === 'login' ? 'register' : 'login');
    this.authError.set('');
  }

  submitAuth() {
    this.authError.set('');
    if (!this.authName.trim() || !this.authPassword.trim()) {
      this.authError.set('Заполните все поля');
      return;
    }

    if (this.authMode() === 'login') {
      const res = this.engine.login(this.authName.trim(), this.authPassword.trim());
      if (res.success) {
        this.closeAuth();
      } else {
        this.authError.set(res.message);
      }
    } else {
      const res = this.engine.register(this.authName.trim(), this.authPassword.trim());
      if (res.success) {
        this.closeAuth();
      } else {
        this.authError.set(res.message);
      }
    }
  }

  logout() {
    if(confirm('Выйти из аккаунта?')) {
      this.engine.logout();
      // Полная перезагрузка для очистки всех стейтов
      window.location.reload();
    }
  }
}
