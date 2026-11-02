import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Socket Service Placeholder
 * Responsibility: Socket.io real-time connection management and event handling.
 */
@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private readonly socketUrl = environment.socketUrl;

  getSocketUrl(): string {
    return this.socketUrl;
  }
}
