import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface ChatParticipant {
  id: string;
  userId: string;
  fullName: string;
  role: string;
  roleInChat: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastActiveAt?: string;
}

export interface ChatConversation {
  id: string;
  tenantId: string;
  branchId?: string | null;
  conversationType: number; // 1 = Direct1on1, 2 = ClassGroup, 3 = StaffGroup, 4 = Broadcast
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  title: string;
  description?: string;
  lastMessageContent?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  lastMessageSenderName?: string;
  unreadCount: number;
  isOnline: boolean;
  avatarUrl?: string;
  targetUserRole?: string;
  targetUserId?: string;
  participants: ChatParticipant[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;
  content: string;
  messageType: string; // Text, Image, File
  attachmentUrl?: string;
  attachmentFileName?: string;
  fileSizeBytes?: number;
  createdAt: string;
  isMe: boolean;
}

export interface ChatDirectoryUser {
  userId: string;
  fullName: string;
  username: string;
  userRole: string;
  className?: string;
  sectionName?: string;
  rollNumber?: string;
  employeeCode?: string;
  designation?: string;
  profilePhoto?: string;
  isOnline: boolean;
  isSameClass: boolean;
  existingConversationId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private hubConnection: HubConnection | null = null;
  private currentJoinedConvId: string | null = null;
  private typingTimeout: any = null;

  // Reactive state signals
  readonly conversations = signal<ChatConversation[]>([]);
  readonly activeConversation = signal<ChatConversation | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly loadingConversations = signal<boolean>(false);
  readonly loadingMessages = signal<boolean>(false);
  readonly isConnected = signal<boolean>(false);
  readonly typingStatus = signal<string | null>(null);

  readonly totalUnreadCount = computed(() => {
    return this.conversations().reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  });

  initHub(): void {
    const token = this.authService.getToken();
    if (!token || !this.authService.isLoggedIn()) return;

    if (this.hubConnection && this.hubConnection.state === 'Connected') return;

    const hubUrl = `${environment.apiBaseUrl}/hubs/chat`;
    try {
      this.hubConnection = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => this.authService.getToken() || token
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
        .configureLogging(LogLevel.None)
        .build();

      this.hubConnection.on('ReceiveMessage', (message: ChatMessage) => {
        const active = this.activeConversation();
        const currentUserId = this.authService.currentUser()?.userId;
        message.isMe = message.senderUserId === currentUserId;

        if (active && active.id === message.conversationId) {
          this.messages.update(msgs => [...msgs, message]);
          // Auto mark as read on active open room
          this.markAsRead(active.id, message.id);
        }

        // Update conversation in list
        this.conversations.update(list => {
          return list.map(c => {
            if (c.id === message.conversationId) {
              const isCurrentOpen = active?.id === c.id;
              return {
                ...c,
                lastMessageContent: message.content || (message.attachmentFileName ? `📎 ${message.attachmentFileName}` : ''),
                lastMessageAt: message.createdAt,
                lastMessageSenderName: message.senderName,
                unreadCount: isCurrentOpen ? 0 : (c.unreadCount + 1)
              };
            }
            return c;
          }).sort((a, b) => {
            const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return timeB - timeA;
          });
        });
      });

      this.hubConnection.on('ConversationUpdated', (data: { conversationId: string; lastMessageContent: string; lastMessageAt: string; lastMessageSenderName: string; unreadCount: number }) => {
        const active = this.activeConversation();
        this.conversations.update(list => {
          return list.map(c => {
            if (c.id === data.conversationId) {
              return {
                ...c,
                lastMessageContent: data.lastMessageContent,
                lastMessageAt: data.lastMessageAt,
                lastMessageSenderName: data.lastMessageSenderName,
                unreadCount: active?.id === c.id ? 0 : data.unreadCount
              };
            }
            return c;
          }).sort((a, b) => {
            const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return timeB - timeA;
          });
        });
      });

      this.hubConnection.on('UserTyping', (data: { conversationId: string; userId: string; fullName: string; isTyping: boolean }) => {
        const active = this.activeConversation();
        if (active && active.id === data.conversationId) {
          if (data.isTyping) {
            this.typingStatus.set(`${data.fullName} is typing...`);
            if (this.typingTimeout) clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => this.typingStatus.set(null), 3500);
          } else {
            this.typingStatus.set(null);
          }
        }
      });

      this.hubConnection.on('MessageDeleted', (data: { conversationId: string; messageId: string }) => {
        this.messages.update(list => list.filter(m => m.id !== data.messageId));
      });

      this.hubConnection.on('ConversationCleared', (data: { conversationId: string }) => {
        const active = this.activeConversation();
        if (active?.id === data.conversationId) {
          this.messages.set([]);
        }
      });

      this.hubConnection.start()
        .then(() => {
          this.isConnected.set(true);
          // If already in an active room, join it on reconnect
          if (this.currentJoinedConvId) {
            this.hubConnection?.invoke('JoinConversation', this.currentJoinedConvId).catch(() => {});
          }
        })
        .catch(err => {
          console.warn('[ChatHub] Connection failed:', err);
          this.isConnected.set(false);
        });

      this.hubConnection.onclose(() => this.isConnected.set(false));
      this.hubConnection.onreconnected(() => this.isConnected.set(true));
    } catch (e) {
      console.warn('[ChatHub] Setup error:', e);
    }
  }

  loadConversations(): Observable<ChatConversation[]> {
    this.loadingConversations.set(true);
    return this.http.get<ChatConversation[]>(`${environment.apiUrl}/chat/conversations`).pipe(
      tap({
        next: (res) => {
          this.conversations.set(res || []);
          this.loadingConversations.set(false);
        },
        error: () => this.loadingConversations.set(false)
      })
    );
  }

  selectConversation(conv: ChatConversation): void {
    if (this.currentJoinedConvId && this.hubConnection) {
      this.hubConnection.invoke('LeaveConversation', this.currentJoinedConvId).catch(() => {});
    }

    this.activeConversation.set(conv);
    this.currentJoinedConvId = conv.id;

    // Reset unread locally
    this.conversations.update(list => list.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));

    if (this.hubConnection && this.hubConnection.state === 'Connected') {
      this.hubConnection.invoke('JoinConversation', conv.id).catch(() => {});
    }

    this.loadMessages(conv.id);
  }

  leaveConversation(conversationId: string): void {
    if (this.hubConnection && this.hubConnection.state === 'Connected') {
      this.hubConnection.invoke('LeaveConversation', conversationId).catch(() => {});
    }
    if (this.currentJoinedConvId === conversationId) {
      this.currentJoinedConvId = null;
    }
  }

  loadMessages(conversationId: string, page = 1): void {
    this.loadingMessages.set(true);
    this.http.get<{ total: number; page: number; pageSize: number; messages: ChatMessage[] }>(
      `${environment.apiUrl}/chat/conversations/${conversationId}/messages?page=${page}&pageSize=60`
    ).subscribe({
      next: (res) => {
        const msgs = (res?.messages || []).map(m => ({
          ...m,
          isMe: m.senderUserId === this.authService.currentUser()?.userId
        }));
        this.messages.set(msgs);
        this.loadingMessages.set(false);

        // Mark last message as read
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          this.markAsRead(conversationId, lastMsg.id);
        }
      },
      error: () => this.loadingMessages.set(false)
    });
  }

  sendMessage(content: string, attachment?: { url: string; fileName: string; fileSizeBytes: number; messageType: string }): void {
    const active = this.activeConversation();
    if (!active) return;

    const payload = {
      conversationId: active.id,
      content: content.trim(),
      messageType: attachment?.messageType || 'Text',
      attachmentUrl: attachment?.url,
      attachmentFileName: attachment?.fileName,
      fileSizeBytes: attachment?.fileSizeBytes
    };

    if (this.hubConnection && this.hubConnection.state === 'Connected') {
      this.hubConnection.invoke('SendMessage', payload).catch(err => {
        console.warn('[ChatHub] SendMessage invoke failed:', err);
      });
    }
  }

  sendTyping(isTyping: boolean): void {
    const active = this.activeConversation();
    if (!active || !this.hubConnection || this.hubConnection.state !== 'Connected') return;
    this.hubConnection.invoke('SendTyping', active.id, isTyping).catch(() => {});
  }

  markAsRead(conversationId: string, lastMessageId: string): void {
    if (!this.hubConnection || this.hubConnection.state !== 'Connected') return;
    this.hubConnection.invoke('MarkAsRead', conversationId, lastMessageId).catch(() => {});
  }

  getDirectory(search = '', filter = 'all'): Observable<ChatDirectoryUser[]> {
    return this.http.get<ChatDirectoryUser[]>(`${environment.apiUrl}/chat/directory`, {
      params: { search, filter }
    });
  }

  startDirectChat(targetUserId: string): Observable<{ conversationId: string; isNew: boolean }> {
    return this.http.post<{ conversationId: string; isNew: boolean }>(`${environment.apiUrl}/chat/direct`, {
      targetUserId
    });
  }

  uploadAttachment(file: File): Observable<{ url: string; fileName: string; fileSizeBytes: number; messageType: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string; fileName: string; fileSizeBytes: number; messageType: string }>(
      `${environment.apiUrl}/chat/upload-attachment`,
      formData
    );
  }

  deleteMessage(messageId: string): Observable<{ success: boolean; messageId: string }> {
    if (this.hubConnection?.state === 'Connected') {
      this.hubConnection.invoke('DeleteMessage', messageId).catch(err => console.warn('Hub DeleteMessage fallback to HTTP', err));
    }
    return this.http.delete<{ success: boolean; messageId: string }>(`${environment.apiUrl}/chat/messages/${messageId}`).pipe(
      tap(() => {
        this.messages.update(list => list.filter(m => m.id !== messageId));
      })
    );
  }

  clearConversation(conversationId: string): Observable<{ success: boolean }> {
    if (this.hubConnection?.state === 'Connected') {
      this.hubConnection.invoke('ClearConversation', conversationId).catch(err => console.warn('Hub ClearConversation fallback to HTTP', err));
    }
    return this.http.delete<{ success: boolean }>(`${environment.apiUrl}/chat/conversations/${conversationId}/clear`).pipe(
      tap(() => {
        if (this.activeConversation()?.id === conversationId) {
          this.messages.set([]);
        }
      })
    );
  }

  stopHub(): void {
    if (this.hubConnection) {
      this.hubConnection.stop().catch(() => {});
      this.hubConnection = null;
      this.isConnected.set(false);
      this.currentJoinedConvId = null;
    }
  }
}
