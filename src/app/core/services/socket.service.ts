import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/**
 * SocketService
 * Responsibility: Central Socket.io real-time connection management and event streaming.
 */
@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private readonly socketUrl = environment.socketUrl;
  private readonly authService = inject(AuthService);
  private socket: Socket | null = null;

  connect(): void {
    if (this.socket && this.socket.connected) {
      return;
    }

    const token = this.authService.getAccessToken();

    this.socket = io(this.socketUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('⚡ Socket connected successfully');
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connection error (will retry):', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  on<T>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      if (!this.socket) {
        this.connect();
      }

      const handler = (data: T) => {
        subscriber.next(data);
      };

      this.socket?.on(event, handler);

      return () => {
        this.socket?.off(event, handler);
      };
    });
  }

  emit(event: string, data?: any): void {
    if (!this.socket) {
      this.connect();
    }
    this.socket?.emit(event, data);
  }

  getSocketUrl(): string {
    return this.socketUrl;
  }
}
