import { Component, OnInit, OnDestroy, AfterViewChecked, ElementRef, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { ChatService, ChatConversation, ChatMessage } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalDatetimePipe } from '../../shared/pipes/local-datetime.pipe';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { ChatDirectoryDialogComponent } from './chat-directory-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
    MatMenuModule,
    LocalDatetimePipe,
    IstDatetimeDirective
  ],
  template: `
    <div class="page-container">
      <!-- Standard Page Header Bar -->
      <div class="chat-page-header">
        <div class="header-left">
          <div class="icon-bubble">
            <mat-icon>forum</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Campus Connect • Real-Time Chat</h1>
            <p class="page-subtitle">
              Class-wise peer discussions, direct campus messaging & faculty assistance
              <strong *ngIf="authService.currentUser()?.branchName"> • {{ authService.currentUser()?.branchName }}</strong>
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button mat-raised-button color="primary" class="new-chat-btn" (click)="openDirectoryDialog()">
            <mat-icon>chat</mat-icon>
            <span>+ Start New Chat</span>
          </button>
          <button mat-stroked-button class="refresh-btn" (click)="refreshConversations()" matTooltip="Refresh conversations">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Main Chat Shell (Dual Panel Card) -->
      <mat-card class="chat-shell-card" [class.mobile-view-active]="activeChat() !== null">
        <div class="chat-layout-grid">

          <!-- Left Sidebar Panel: Conversation List -->
          <div class="sidebar-panel" [class.hidden-on-mobile]="activeChat() !== null">
            <!-- Search & Filter Deck -->
            <div class="sidebar-top-deck">
              <mat-form-field appearance="outline" class="search-form-field" subscriptSizing="dynamic">
                <mat-icon matPrefix>search</mat-icon>
                <input matInput [formControl]="searchControl" placeholder="Search chats or members...">
                <button *ngIf="searchControl.value" mat-icon-button matSuffix type="button" (click)="searchControl.setValue('')">
                  <mat-icon>close</mat-icon>
                </button>
              </mat-form-field>

              <mat-button-toggle-group [formControl]="tabFilterControl" class="category-toggle" aria-label="Conversation Category">
                <mat-button-toggle value="all">All ({{ getCount('all') }})</mat-button-toggle>
                <mat-button-toggle value="class">Class Groups ({{ getCount('class') }})</mat-button-toggle>
                <mat-button-toggle value="direct">Direct 1-on-1 ({{ getCount('direct') }})</mat-button-toggle>
              </mat-button-toggle-group>
            </div>

            <!-- Conversation Scroll List -->
            <div class="conversations-scroll-box">
              <div *ngIf="chatService.loadingConversations()" class="loading-box">
                <mat-spinner diameter="28"></mat-spinner>
                <span>Loading conversations...</span>
              </div>

              <div *ngIf="!chatService.loadingConversations() && filteredConversations().length === 0" class="empty-conversations">
                <mat-icon class="empty-icon">chat_bubble_outline</mat-icon>
                <p class="empty-title">
                  <span *ngIf="searchQuery()">No chats matching "{{ searchQuery() }}"</span>
                  <span *ngIf="!searchQuery() && activeTab() === 'class'">No class channels joined yet</span>
                  <span *ngIf="!searchQuery() && activeTab() === 'direct'">No 1-on-1 direct chats yet</span>
                  <span *ngIf="!searchQuery() && activeTab() === 'all'">No conversations yet</span>
                </p>
                <p class="empty-sub">
                  <span *ngIf="activeTab() === 'direct'">Click 'Find People' to start a direct message with any student or faculty.</span>
                  <span *ngIf="activeTab() === 'class'">Class channels will auto-appear once created for your campus.</span>
                  <span *ngIf="activeTab() === 'all' || searchQuery()">Explore the campus directory to message classmates or teachers.</span>
                </p>
                <button mat-stroked-button color="primary" class="start-btn-empty" (click)="openDirectoryDialog()">
                  <mat-icon>group_add</mat-icon>
                  <span>+ Find People to Chat</span>
                </button>
              </div>

              <div *ngFor="let c of filteredConversations()" 
                   class="conversation-row" 
                   [class.selected]="activeChat()?.id === c.id"
                   (click)="onSelectConversation(c)">
                
                <div class="avatar-box">
                  <div class="conv-avatar" [ngClass]="getAvatarClass(c)">
                    <mat-icon *ngIf="c.conversationType === 2">groups</mat-icon>
                    <span *ngIf="c.conversationType !== 2">{{ getInitials(c.title) }}</span>
                  </div>
                  <span *ngIf="c.conversationType === 1" class="presence-dot" [class.online]="c.isOnline"></span>
                </div>

                <div class="conv-details">
                  <div class="title-row">
                    <strong class="conv-title">{{ c.title }}</strong>
                    <span *ngIf="c.lastMessageAt" class="conv-time">
                      {{ c.lastMessageAt | localDatetime:'shortTime' }}
                    </span>
                  </div>

                  <div class="meta-tag-row">
                    <span *ngIf="c.conversationType === 2" class="conv-type-badge class">
                      🏫 Class Channel
                    </span>
                    <span *ngIf="c.conversationType === 1" class="conv-type-badge direct">
                      👤 Direct 1-on-1<span *ngIf="c.targetUserRole"> • {{ c.targetUserRole }}</span>
                    </span>
                  </div>

                  <div class="message-preview-row">
                    <span class="preview-text">
                      <span *ngIf="c.lastMessageSenderName && c.conversationType === 2" class="sender-prefix">
                        {{ c.lastMessageSenderName.split(' ')[0] }}:
                      </span>
                      {{ c.lastMessageContent || 'No messages yet' }}
                    </span>
                    <span *ngIf="c.unreadCount > 0" class="unread-badge">
                      {{ c.unreadCount > 99 ? '99+' : c.unreadCount }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Main Panel: Active Conversation View -->
          <div class="main-chat-panel" [class.visible-on-mobile]="activeChat() !== null">

            <!-- Empty State when no chat is selected -->
            <div *ngIf="!activeChat()" class="no-chat-selected">
              <div class="welcome-box">
                <div class="welcome-icon-bubble">
                  <mat-icon>maps_ugc</mat-icon>
                </div>
                <h2>Campus Messaging System</h2>
                <p>Select a class group or direct conversation from the left to start chatting in real time.</p>
                <div class="quick-tips">
                  <div class="tip-item">
                    <mat-icon>verified</mat-icon>
                    <span>Instant delivery with sub-second SignalR live push</span>
                  </div>
                  <div class="tip-item">
                    <mat-icon>lock</mat-icon>
                    <span>Strict multi-tenant & branch-wise student & faculty isolation</span>
                  </div>
                </div>
                <button mat-raised-button color="primary" class="browse-directory-btn" (click)="openDirectoryDialog()">
                  <mat-icon>search</mat-icon>
                  <span>Explore Campus Directory</span>
                </button>
              </div>
            </div>

            <!-- Active Conversation Container -->
            <div *ngIf="activeChat() as chat" class="active-chat-wrapper">

              <!-- Active Chat Header -->
              <div class="active-header">
                <button mat-icon-button class="mobile-back-btn" (click)="activeChat.set(null)" aria-label="Back to conversations">
                  <mat-icon>arrow_back</mat-icon>
                </button>

                <div class="header-avatar-box">
                  <div class="conv-avatar header-avatar" [ngClass]="getAvatarClass(chat)">
                    <mat-icon *ngIf="chat.conversationType === 2">groups</mat-icon>
                    <span *ngIf="chat.conversationType !== 2">{{ getInitials(chat.title) }}</span>
                  </div>
                  <span *ngIf="chat.conversationType === 1" class="presence-dot" [class.online]="chat.isOnline"></span>
                </div>

                <div class="header-title-details">
                  <div class="top-row">
                    <h2 class="active-title">{{ chat.title }}</h2>
                    <span *ngIf="chat.conversationType === 2" class="channel-pill">
                      🏫 CLASS CHANNEL
                    </span>
                    <span *ngIf="chat.conversationType === 1 && chat.targetUserRole" class="channel-pill user">
                      {{ chat.targetUserRole }}
                    </span>
                  </div>

                  <div class="active-sub">
                    <span *ngIf="chatService.typingStatus()" class="typing-notice">
                      <mat-icon class="pulse-icon">edit</mat-icon>
                      {{ chatService.typingStatus() }}
                    </span>
                    <span *ngIf="!chatService.typingStatus() && chat.conversationType === 1" class="status-indicator">
                      {{ chat.isOnline ? '🟢 Online now' : '⚪ Offline' }}
                    </span>
                    <span *ngIf="!chatService.typingStatus() && chat.conversationType === 2" class="status-indicator">
                      {{ chat.participants.length }} Members enrolled
                    </span>
                  </div>
                </div>

                <div class="active-header-actions">
                  <button mat-icon-button type="button" (click)="refreshActiveMessages()" matTooltip="Reload messages">
                    <mat-icon>sync</mat-icon>
                  </button>

                  <button mat-icon-button type="button" [matMenuTriggerFor]="activeChatMenu" matTooltip="Conversation options">
                    <mat-icon>more_vert</mat-icon>
                  </button>

                  <mat-menu #activeChatMenu="matMenu">
                    <button mat-menu-item (click)="onClearChatHistory()">
                      <mat-icon style="color: #ef4444;">delete_sweep</mat-icon>
                      <span style="color: #ef4444; font-weight: 600;">Clear Chat History</span>
                    </button>
                  </mat-menu>
                </div>
              </div>

              <!-- Message Stream Scroll Container -->
              <div #messageScrollBox class="message-stream-box">
                <div *ngIf="chatService.loadingMessages()" class="stream-loader">
                  <mat-spinner diameter="24"></mat-spinner>
                  <span>Loading message history...</span>
                </div>

                <div *ngIf="!chatService.loadingMessages() && chatService.messages().length === 0" class="stream-empty">
                  <mat-icon>waving_hand</mat-icon>
                  <p>Say hello! Be the first to start the conversation.</p>
                </div>

                <div *ngFor="let msg of chatService.messages(); let i = index" 
                     class="message-row" 
                     [class.outgoing]="msg.isMe" 
                     [class.incoming]="!msg.isMe">

                  <!-- Incoming Sender Avatar -->
                  <div *ngIf="!msg.isMe && (i === 0 || chatService.messages()[i - 1].senderUserId !== msg.senderUserId)" class="msg-sender-avatar">
                    {{ getInitials(msg.senderName) }}
                  </div>
                  <div *ngIf="!msg.isMe && (i > 0 && chatService.messages()[i - 1].senderUserId === msg.senderUserId)" class="avatar-spacer"></div>

                  <!-- Hover Action Toolbar (Delete Message) -->
                  <div *ngIf="canDeleteMessage(msg)" class="msg-actions-hover">
                    <button type="button" class="bubble-action-btn delete-action" (click)="onDeleteMessage(msg, $event)" matTooltip="Delete message">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>

                  <div class="message-bubble" [class.outgoing-bubble]="msg.isMe">
                    <!-- Sender Name in Group Chat -->
                    <div *ngIf="!msg.isMe && chat.conversationType === 2 && (i === 0 || chatService.messages()[i - 1].senderUserId !== msg.senderUserId)" class="sender-header">
                      <strong class="sender-name">{{ msg.senderName }}</strong>
                      <span class="sender-role-pill" [class.teacher]="msg.senderRole === 'Teacher' || msg.senderRole === 'Principal'">
                        {{ msg.senderRole }}
                      </span>
                    </div>

                    <!-- Attachment Preview if Image or Document -->
                    <div *ngIf="msg.attachmentUrl" class="attachment-box">
                      <!-- Image Preview with Click-to-Download -->
                      <div *ngIf="msg.messageType === 'Image'" class="image-attachment-wrapper" (click)="downloadAttachment(msg, $event)">
                        <img [src]="getFileFullUrl(msg.attachmentUrl)" [alt]="msg.attachmentFileName || 'Attachment'" class="attachment-thumbnail" loading="lazy">
                        <button type="button" class="img-download-overlay" (click)="downloadAttachment(msg, $event)" matTooltip="Download Image">
                          <mat-icon>download</mat-icon>
                        </button>
                      </div>

                      <!-- Document Card with Click-to-Download -->
                      <div *ngIf="msg.messageType !== 'Image'" class="doc-attachment-card" (click)="downloadAttachment(msg, $event)" role="button" tabindex="0">
                        <mat-icon class="doc-icon">description</mat-icon>
                        <div class="doc-meta">
                          <strong class="doc-title">{{ msg.attachmentFileName || 'Download Document' }}</strong>
                          <span *ngIf="msg.fileSizeBytes" class="doc-size">{{ formatFileSize(msg.fileSizeBytes) }}</span>
                        </div>
                        <button type="button" class="card-dl-btn" (click)="downloadAttachment(msg, $event)" matTooltip="Download">
                          <mat-icon class="dl-icon">download</mat-icon>
                        </button>
                      </div>
                    </div>

                    <!-- Message Text -->
                    <div *ngIf="msg.content" class="message-text">
                      {{ msg.content }}
                    </div>

                    <!-- Timestamp and Read Status -->
                    <div class="message-footer">
                      <span class="message-time">
                        {{ msg.createdAt | localDatetime:'shortTime' }}
                      </span>
                      <mat-icon *ngIf="msg.isMe" class="tick-icon">done_all</mat-icon>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Pending Attachment Preview Bar -->
              <div *ngIf="pendingAttachment()" class="pending-attachment-bar">
                <mat-icon class="preview-icon">attach_file</mat-icon>
                <div class="pending-meta">
                  <span class="pending-filename">{{ pendingAttachment()?.fileName }}</span>
                  <span class="pending-filesize">({{ formatFileSize(pendingAttachment()?.fileSizeBytes || 0) }})</span>
                </div>
                <button mat-icon-button type="button" class="remove-attachment-btn" (click)="removePendingAttachment()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <!-- Bottom Input Dock -->
              <div class="bottom-input-dock">
                <input #fileInput type="file" style="display: none;" (change)="onFileSelected($event)">

                <button mat-icon-button type="button" class="action-dock-btn" (click)="fileInput.click()" [disabled]="uploadingAttachment()" matTooltip="Attach image or file">
                  <mat-icon *ngIf="!uploadingAttachment()">attach_file</mat-icon>
                  <mat-spinner *ngIf="uploadingAttachment()" diameter="18"></mat-spinner>
                </button>

                <!-- Emoji Picker Trigger Button -->
                <button mat-icon-button type="button" class="action-dock-btn emoji-trigger-btn" [matMenuTriggerFor]="emojiMenu" matTooltip="Add emoji">
                  <mat-icon>sentiment_satisfied_alt</mat-icon>
                </button>

                <!-- Categorized Emoji Menu -->
                <mat-menu #emojiMenu="matMenu" class="emoji-picker-menu" xPosition="before" yPosition="above">
                  <div class="emoji-picker-container" (click)="$event.stopPropagation()">
                    <!-- Category Tabs -->
                    <div class="emoji-cat-tabs">
                      <button *ngFor="let cat of emojiCategories; let ci = index" 
                              type="button" 
                              class="cat-tab-btn" 
                              [class.active]="selectedEmojiCategory() === ci"
                              (click)="selectedEmojiCategory.set(ci)">
                        <mat-icon>{{ cat.icon }}</mat-icon>
                        <span>{{ cat.name }}</span>
                      </button>
                    </div>

                    <!-- Emoji Grid -->
                    <div class="emoji-grid">
                      <button *ngFor="let em of emojiCategories[selectedEmojiCategory()].emojis" 
                              type="button" 
                              class="emoji-btn" 
                              (click)="insertEmoji(em)">
                        {{ em }}
                      </button>
                    </div>
                  </div>
                </mat-menu>

                <div class="message-input-wrapper">
                  <textarea 
                    #messageTextarea
                    class="chat-textarea" 
                    [formControl]="messageControl" 
                    placeholder="Type a message... (Press Enter to send)"
                    rows="1"
                    (keydown)="onTextareaKeyDown($event)"
                    (input)="onTextInput()"></textarea>
                </div>

                <button 
                  mat-flat-button 
                  color="primary" 
                  class="send-message-btn" 
                  [disabled]="(!messageControl.value || !messageControl.value.trim()) && !pendingAttachment()"
                  (click)="onSendMessage()">
                  <mat-icon>send</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page-container {
      padding: 0 0 8px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Page Header */
    .chat-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      background: #ffffff;
      padding: 10px 18px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;

        .icon-bubble {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }

        .page-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.2;
        }

        .page-subtitle {
          font-size: 0.78rem;
          color: #64748b;
          margin: 2px 0 0;
          strong { color: #1e40af; }
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        .new-chat-btn {
          height: 36px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.82rem;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }
        .refresh-btn {
          height: 36px;
          width: 36px;
          min-width: 36px;
          padding: 0;
          border-radius: 8px;
        }
      }
    }

    /* Main Card Two-Panel Shell */
    .chat-shell-card {
      border-radius: 12px !important;
      overflow: hidden !important;
      border: 1px solid #e2e8f0 !important;
      box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.08) !important;
      background: #ffffff !important;
      height: calc(100vh - 265px);
      min-height: 460px;
      padding: 0 !important;
    }

    .chat-layout-grid {
      display: grid;
      grid-template-columns: 340px 1fr;
      height: 100%;
      width: 100%;
      overflow: hidden;
    }

    /* Left Sidebar Panel */
    .sidebar-panel {
      border-right: 1px solid #e2e8f0;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .sidebar-top-deck {
      padding: 12px 14px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .search-form-field {
        width: 100%;
      }

      .category-toggle {
        width: 100%;
        display: flex;
        border-radius: 6px;
        overflow: hidden;
        mat-button-toggle {
          flex: 1;
          font-size: 0.76rem;
          font-weight: 600;
        }
      }
    }

    .conversations-scroll-box {
      flex: 1;
      overflow-y: auto;
      padding: 6px 0;
    }

    .loading-box, .empty-conversations {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: #64748b;
      gap: 8px;

      .empty-icon { font-size: 40px; width: 40px; height: 40px; color: #94a3b8; }
      .empty-title { font-weight: 700; color: #1e293b; margin: 0; }
      .empty-sub { font-size: 0.8rem; margin: 0; color: #64748b; }
      .start-btn-empty { margin-top: 8px; border-radius: 6px; font-weight: 600; }
    }

    .conv-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: #ffffff;
      font-weight: 700;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      justify-content: center;
      text-transform: uppercase;
      line-height: 1;
      letter-spacing: 0.5px;
      user-select: none;
      flex-shrink: 0;

      &.class-group {
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        border-radius: 12px;
      }
      &.teacher-direct {
        background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
      }
    }

    .conversation-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      cursor: pointer;
      border-bottom: 1px solid #f1f5f9;
      transition: all 0.15s ease-in-out;

      &:hover {
        background: #f8fafc;
      }

      &.selected {
        background: #eff6ff;
        border-left: 3px solid #2563eb;
      }

      .avatar-box {
        position: relative;
        flex-shrink: 0;

        .presence-dot {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #94a3b8;
          border: 2px solid #ffffff;

          &.online { background: #22c55e; }
        }
      }

      .conv-details {
        flex: 1;
        min-width: 0;

        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;

          .conv-title {
            font-size: 0.92rem;
            color: #0f172a;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .conv-time {
            font-size: 0.7rem;
            color: #94a3b8;
            flex-shrink: 0;
          }
        }

        .meta-tag-row {
          margin: 2px 0;
          display: flex;
          align-items: center;

          .conv-type-badge {
            font-size: 0.65rem;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;

            &.class {
              background: #e0f2fe;
              color: #0369a1;
            }
            &.direct {
              background: #f1f5f9;
              color: #475569;
            }
          }
        }

        .message-preview-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 3px;
          gap: 8px;

          .preview-text {
            font-size: 0.8rem;
            color: #64748b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;

            .sender-prefix {
              font-weight: 600;
              color: #1e40af;
            }
          }

          .unread-badge {
            background: #2563eb;
            color: #ffffff;
            font-size: 0.68rem;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 10px;
            flex-shrink: 0;
          }
        }
      }
    }

    /* Right Main Chat Panel */
    .main-chat-panel {
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      position: relative;
    }

    /* Empty Welcome State */
    .no-chat-selected {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;

      .welcome-box {
        max-width: 440px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;

        .welcome-icon-bubble {
          width: 68px;
          height: 68px;
          border-radius: 20px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 36px; width: 36px; height: 36px; }
        }

        h2 { margin: 0; font-size: 1.28rem; font-weight: 800; color: #0f172a; }
        p { margin: 0; font-size: 0.88rem; color: #64748b; line-height: 1.4; }

        .quick-tips {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 12px 0;
          text-align: left;
          width: 100%;

          .tip-item {
            display: flex;
            align-items: center;
            gap: 10px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 0.8rem;
            color: #334155;
            mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
          }
        }

        .browse-directory-btn {
          border-radius: 8px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      }
    }

    /* Active Conversation Header */
    .active-chat-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .active-header {
      padding: 10px 18px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      flex-shrink: 0;

      .mobile-back-btn {
        display: none;
      }

      .header-avatar-box {
        position: relative;
        flex-shrink: 0;

        .header-avatar {
          width: 42px;
          height: 42px;
          font-size: 0.92rem;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
        }

        .presence-dot {
          position: absolute;
          bottom: 0px;
          right: 0px;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #94a3b8;
          border: 2px solid #ffffff;

          &.online { background: #22c55e; }
        }
      }

      .header-title-details {
        flex: 1;
        min-width: 0;

        .top-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .active-title {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 700;
            color: #0f172a;
          }

          .channel-pill {
            font-size: 0.65rem;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 4px;
            background: #e0f2fe;
            color: #0369a1;
            letter-spacing: 0.03em;

            &.user {
              background: #f1f5f9;
              color: #475569;
            }
          }
        }

        .active-sub {
          margin-top: 1px;
          font-size: 0.74rem;

          .status-indicator {
            color: #64748b;
          }

          .typing-notice {
            color: #2563eb;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            .pulse-icon { font-size: 14px; width: 14px; height: 14px; }
          }
        }
      }
    }

    /* Message Stream */
    .message-stream-box {
      flex: 1 1 0;
      min-height: 0;
      overflow-y: auto;
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f1f5f9;
    }

    .stream-loader, .stream-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      color: #64748b;
      gap: 8px;
      mat-icon { font-size: 32px; width: 32px; height: 32px; color: #94a3b8; }
    }

    .message-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      max-width: 78%;

      &.outgoing {
        align-self: flex-end;
        flex-direction: row-reverse;
      }

      &.incoming {
        align-self: flex-start;
      }

      .msg-sender-avatar {
        width: 32px;
        height: 32px;
        min-width: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #475569 0%, #334155 100%);
        color: #ffffff;
        font-size: 0.72rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        text-transform: uppercase;
        line-height: 1;
        letter-spacing: 0.2px;
        user-select: none;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      }
      .avatar-spacer {
        width: 32px;
        flex-shrink: 0;
      }

      .msg-actions-hover {
        opacity: 0;
        visibility: hidden;
        display: flex;
        align-items: center;
        gap: 4px;
        align-self: center;
        transition: opacity 0.15s ease, visibility 0.15s ease;

        .bubble-action-btn {
          width: 26px;
          height: 26px;
          min-width: 26px;
          min-height: 26px;
          padding: 0;
          margin: 0;
          border-radius: 50%;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #94a3b8;
          transition: all 0.15s ease;

          mat-icon {
            font-size: 15px;
            width: 15px;
            height: 15px;
            line-height: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          &.delete-action:hover {
            background: #fee2e2;
            color: #ef4444;
            border-color: #fca5a5;
            transform: scale(1.1);
          }
        }
      }

      &:hover .msg-actions-hover {
        opacity: 1;
        visibility: visible;
      }
    }

    .message-bubble {
      background: #ffffff;
      color: #1e293b;
      padding: 8px 12px;
      border-radius: 12px 12px 12px 2px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      gap: 4px;
      word-break: break-word;

      &.outgoing-bubble {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
        border-radius: 12px 12px 2px 12px;
        box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);

        .doc-attachment-card {
          background: rgba(255, 255, 255, 0.18) !important;
          border: 1px solid rgba(255, 255, 255, 0.28) !important;
          color: #ffffff !important;

          &:hover {
            background: rgba(255, 255, 255, 0.28) !important;
          }

          .doc-icon { color: #ffffff !important; }
          .doc-meta .doc-title { color: #ffffff !important; }
          .card-dl-btn {
            background: rgba(255, 255, 255, 0.25) !important;
            color: #ffffff !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;

            &:hover {
              background: #ffffff !important;
              color: #2563eb !important;
              box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3) !important;
            }
          }
        }

        .message-footer {
          .message-time { color: rgba(255, 255, 255, 0.8); }
          .tick-icon { color: #ffffff; font-size: 14px; width: 14px; height: 14px; }
        }
      }

      .sender-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;

        .sender-name {
          font-size: 0.75rem;
          color: #1e40af;
        }

        .sender-role-pill {
          font-size: 0.62rem;
          font-weight: 700;
          background: #eff6ff;
          color: #2563eb;
          padding: 1px 5px;
          border-radius: 3px;

          &.teacher {
            background: #f3e8ff;
            color: #7c3aed;
          }
        }
      }

      .message-text {
        font-size: 0.88rem;
        line-height: 1.4;
      }

      .message-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        margin-top: 2px;

        .message-time {
          font-size: 0.66rem;
          color: #94a3b8;
        }
        .tick-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
          color: #3b82f6;
        }
      }
    }

    /* Attachment Preview in Bubble */
    .attachment-box {
      margin-bottom: 4px;

      .image-attachment-wrapper {
        position: relative;
        display: inline-block;
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;

        .attachment-thumbnail {
          max-width: 240px;
          max-height: 200px;
          object-fit: cover;
          display: block;
          border-radius: 8px;
          transition: opacity 0.15s ease;

          &:hover {
            opacity: 0.92;
          }
        }

        .img-download-overlay {
          position: absolute;
          bottom: 6px;
          right: 6px;
          background: rgba(15, 23, 42, 0.75);
          color: #ffffff;
          width: 32px;
          height: 32px;
          min-width: 32px;
          min-height: 32px;
          border: none;
          padding: 0;
          margin: 0;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
          cursor: pointer;
          transition: all 0.2s ease-in-out;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            line-height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0;
          }

          &:hover {
            background: #2563eb;
            transform: scale(1.1);
          }

          &:active {
            transform: scale(0.95);
          }
        }
      }

      .doc-attachment-card {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(0, 0, 0, 0.08);
        padding: 8px 12px;
        border-radius: 8px;
        color: inherit;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: rgba(37, 99, 235, 0.1);
          border-color: #93c5fd;
        }

        .doc-icon { font-size: 24px; width: 24px; height: 24px; color: #2563eb; }
        .doc-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;

          .doc-title {
            font-size: 0.82rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #0f172a;
          }
          .doc-size { font-size: 0.68rem; opacity: 0.8; }
        }

        .card-dl-btn {
          width: 32px;
          height: 32px;
          min-width: 32px;
          min-height: 32px;
          padding: 0;
          margin: 0;
          border: none;
          background: rgba(37, 99, 235, 0.08);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          cursor: pointer;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.15);
          transition: all 0.2s ease-in-out;

          mat-icon, .mat-icon, .dl-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            line-height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0;
          }

          &:hover {
            background: #2563eb;
            color: #ffffff;
            box-shadow: 0 3px 8px rgba(37, 99, 235, 0.35);
            transform: scale(1.1);
          }

          &:active {
            transform: scale(0.95);
          }
        }
      }
    }

    /* Pending Attachment Bar */
    .pending-attachment-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #eff6ff;
      border-top: 1px solid #bfdbfe;
      padding: 6px 14px;
      font-size: 0.82rem;
      color: #1e40af;

      .preview-icon { font-size: 18px; width: 18px; height: 18px; }
      .pending-meta {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        .pending-filename { font-weight: 600; }
        .pending-filesize { opacity: 0.8; margin-left: 4px; }
      }
      .remove-attachment-btn {
        width: 28px;
        height: 28px;
        line-height: 28px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }

    /* Bottom Input Dock */
    .bottom-input-dock {
      padding: 8px 14px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      position: relative;
      z-index: 5;
      box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.03);

      .action-dock-btn {
        color: #64748b;
        &:hover { color: #2563eb; }

        &.emoji-trigger-btn {
          color: #d97706;
          &:hover { color: #b45309; }
        }
      }

      .message-input-wrapper {
        flex: 1;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 20px;
        padding: 6px 14px;
        display: flex;
        align-items: center;

        .chat-textarea {
          width: 100%;
          border: none;
          background: transparent;
          outline: none;
          resize: none;
          font-family: inherit;
          font-size: 0.88rem;
          color: #0f172a;
          line-height: 1.3;
          max-height: 80px;

          &::placeholder { color: #94a3b8; }
        }
      }

      .send-message-btn {
        height: 38px;
        min-width: 44px;
        padding: 0 14px;
        border-radius: 19px;
        box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    /* Categorized Emoji Menu Styling */
    ::ng-deep .emoji-picker-menu {
      max-width: none !important;
      border-radius: 12px !important;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.2), 0 8px 10px -6px rgba(15, 23, 42, 0.1) !important;
      border: 1px solid #bfdbfe !important;
      overflow: hidden !important;
      padding: 0 !important;
    }

    .emoji-picker-container {
      width: 320px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;

      .emoji-cat-tabs {
        display: flex;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        padding: 4px;
        gap: 2px;

        .cat-tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: none;
          background: transparent;
          border-radius: 6px;
          padding: 6px 2px;
          cursor: pointer;
          font-size: 0.68rem;
          font-weight: 600;
          color: #64748b;
          transition: all 0.15s ease;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }

          &:hover {
            background: #e2e8f0;
            color: #1e293b;
          }

          &.active {
            background: #2563eb;
            color: #ffffff;
            box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);

            mat-icon {
              color: #ffffff;
            }
          }
        }
      }

      .emoji-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        padding: 8px;
        max-height: 200px;
        overflow-y: auto;

        .emoji-btn {
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 1.3rem;
          line-height: 1;
          padding: 6px 2px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s ease, background 0.12s ease;

          &:hover {
            background: #eff6ff;
            transform: scale(1.25);
          }
          &:active {
            transform: scale(1.05);
          }
        }
      }
    }

    /* Responsive Adaptation for Mobile & Tablet */
    @media (max-width: 768px) {
      .chat-layout-grid {
        grid-template-columns: 1fr;
      }

      .sidebar-panel.hidden-on-mobile {
        display: none;
      }

      .main-chat-panel {
        display: none;
        &.visible-on-mobile {
          display: flex;
        }
      }

      .active-header .mobile-back-btn {
        display: inline-flex;
      }

      .message-row {
        max-width: 90%;
      }
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageScrollBox') private messageScrollBox?: ElementRef;
  @ViewChild('messageTextarea') private messageTextarea?: ElementRef;

  chatService = inject(ChatService);
  authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private confirmDialog = inject(ConfirmDialogService);

  readonly searchControl = new FormControl('');
  readonly tabFilterControl = new FormControl('all');
  readonly searchQuery = signal<string>('');
  readonly activeTab = signal<string>('all');
  readonly messageControl = new FormControl('');

  readonly activeChat = this.chatService.activeConversation;
  readonly pendingAttachment = signal<{ url: string; fileName: string; fileSizeBytes: number; messageType: string } | null>(null);
  readonly uploadingAttachment = signal<boolean>(false);
  readonly selectedEmojiCategory = signal<number>(0);

  readonly emojiCategories = [
    {
      name: 'Smileys',
      icon: 'mood',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😎', '🤩', '🥳', '😏', '🤔', '🤫', '🫡', '🤐', '😐', '😑', '😶', '😴', '😷', '🤒', '🤕']
    },
    {
      name: 'Gestures',
      icon: 'thumb_up',
      emojis: ['👍', '👎', '👌', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '👋', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪']
    },
    {
      name: 'Campus',
      icon: 'school',
      emojis: ['📚', '📖', '📕', '📗', '📘', '📙', '📓', '📒', '✏️', '✒️', '🖊️', '📝', '📐', '📏', '🔬', '🔭', '💻', '🖥️', '📱', '🎒', '🎓', '🏫', '🏛️', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '🎯', '💡', '🧠', '📊', '📈', '📉', '📅', '🔔']
    },
    {
      name: 'Symbols',
      icon: 'celebration',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '🔥', '✨', '⭐', '🌟', '💥', '🎉', '🎊', '🎈', '🚀', '✅', '❌', '❓', '❗', '⚠️', '📢', '📣', '💬', '💭', '☕', '⏳', '☀️', '🌈']
    }
  ];

  private shouldScrollToBottom = false;

  readonly filteredConversations = computed(() => {
    const list = this.chatService.conversations();
    const query = this.searchQuery().trim().toLowerCase();
    const tab = this.activeTab();

    return list.filter(c => {
      // Tab filter
      // 1 = Direct1on1, 2 = ClassGroup, 3 = StaffGroup, 4 = Broadcast
      if (tab === 'class' && c.conversationType !== 2) return false;
      if (tab === 'direct' && c.conversationType !== 1) return false;

      // Query filter
      if (query) {
        const titleMatch = c.title.toLowerCase().includes(query);
        const lastMsgMatch = c.lastMessageContent?.toLowerCase().includes(query) ?? false;
        const classNameMatch = c.className?.toLowerCase().includes(query) ?? false;
        const sectionNameMatch = c.sectionName?.toLowerCase().includes(query) ?? false;
        const descMatch = c.description?.toLowerCase().includes(query) ?? false;
        return titleMatch || lastMsgMatch || classNameMatch || sectionNameMatch || descMatch;
      }
      return true;
    });
  });

  getCount(tab: string): number {
    const list = this.chatService.conversations();
    if (tab === 'class') return list.filter(c => c.conversationType === 2).length;
    if (tab === 'direct') return list.filter(c => c.conversationType === 1).length;
    return list.length;
  }

  ngOnInit(): void {
    this.searchControl.valueChanges.subscribe(v => this.searchQuery.set(v || ''));
    this.tabFilterControl.valueChanges.subscribe(v => this.activeTab.set(v || 'all'));
    this.chatService.initHub();
    this.refreshConversations();
  }

  ngOnDestroy(): void {
    // Leave room
    if (this.activeChat()) {
      this.chatService.leaveConversation(this.activeChat()!.id);
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  refreshConversations(): void {
    this.chatService.loadConversations().subscribe({
      next: (list) => {
        // Auto select first conversation if none selected and on desktop
        if (!this.activeChat() && list.length > 0 && window.innerWidth > 768) {
          this.onSelectConversation(list[0]);
        }
      }
    });
  }

  onSelectConversation(conv: ChatConversation): void {
    this.chatService.selectConversation(conv);
    this.shouldScrollToBottom = true;
  }

  refreshActiveMessages(): void {
    if (this.activeChat()) {
      this.chatService.loadMessages(this.activeChat()!.id);
      this.shouldScrollToBottom = true;
    }
  }

  onTextareaKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }

  onTextInput(): void {
    this.chatService.sendTyping(true);
  }

  onSendMessage(): void {
    const content = (this.messageControl.value || '').trim();
    const attachment = this.pendingAttachment();

    if (!content && !attachment) return;

    this.chatService.sendMessage(content, attachment || undefined);

    this.messageControl.setValue('');
    this.pendingAttachment.set(null);
    this.shouldScrollToBottom = true;

    // Refocus textarea
    setTimeout(() => this.messageTextarea?.nativeElement?.focus(), 50);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.uploadingAttachment.set(true);

      this.chatService.uploadAttachment(file).subscribe({
        next: (res) => {
          this.pendingAttachment.set(res);
          this.uploadingAttachment.set(false);
          input.value = '';
        },
        error: () => {
          this.uploadingAttachment.set(false);
          input.value = '';
        }
      });
    }
  }

  removePendingAttachment(): void {
    this.pendingAttachment.set(null);
  }

  openDirectoryDialog(): void {
    const ref = this.dialog.open(ChatDirectoryDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'erp-confirm-dialog-panel',
      disableClose: false
    });

    ref.afterClosed().subscribe((result?: { conversationId: string }) => {
      if (result?.conversationId) {
        this.chatService.loadConversations().subscribe({
          next: (list) => {
            const found = list.find(c => c.id === result.conversationId);
            if (found) {
              this.onSelectConversation(found);
            }
          }
        });
      }
    });
  }

  getInitials(name?: string | null): string {
    if (!name) return 'C';
    const clean = name.replace(/[()[\]{}_/\\-]/g, ' ').replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = clean.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return 'C';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  getAvatarClass(c: ChatConversation): string {
    if (c.conversationType === 2) return 'class-group';
    if (c.targetUserRole === 'Teacher' || c.targetUserRole === 'Principal') return 'teacher-direct';
    return '';
  }

  insertEmoji(emoji: string): void {
    const textarea = this.messageTextarea?.nativeElement as HTMLTextAreaElement | undefined;
    const currentVal = this.messageControl.value || '';

    if (textarea) {
      const start = textarea.selectionStart ?? currentVal.length;
      const end = textarea.selectionEnd ?? currentVal.length;
      const newVal = currentVal.substring(0, start) + emoji + currentVal.substring(end);
      this.messageControl.setValue(newVal);

      setTimeout(() => {
        textarea.focus();
        const newPos = start + emoji.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 10);
    } else {
      this.messageControl.setValue(currentVal + emoji);
    }
  }

  getFileFullUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const baseUrl = (environment.apiBaseUrl || '').replace(/\/+$/, '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return baseUrl ? `${baseUrl}${cleanUrl}` : cleanUrl;
  }

  downloadAttachment(msg: ChatMessage, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!msg.attachmentUrl) return;

    const fullUrl = this.getFileFullUrl(msg.attachmentUrl);
    const fileName = msg.attachmentFileName || 'attachment';

    // Direct blob download for seamless file saving across ports
    fetch(fullUrl)
      .then(res => {
        if (!res.ok) throw new Error('File download failed');
        return res.blob();
      })
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(blobUrl);
        link.remove();
      })
      .catch(err => {
        console.warn('[Chat] Direct download failed, fallback to window.open', err);
        window.open(fullUrl, '_blank');
      });
  }

  canDeleteMessage(msg: ChatMessage): boolean {
    if (msg.isMe) return true;
    const role = this.authService.currentUser()?.role || '';
    return role.includes('Admin') || role.includes('Teacher') || role.includes('Principal');
  }

  onDeleteMessage(msg: ChatMessage, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.confirmDialog.danger(
      'Delete Message',
      'Are you sure you want to delete this message? This action will remove it for everyone.',
      'Delete'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.chatService.deleteMessage(msg.id).subscribe();
      }
    });
  }

  onClearChatHistory(): void {
    const active = this.activeChat();
    if (!active) return;
    this.confirmDialog.danger(
      'Clear Chat History',
      `Are you sure you want to clear all messages in "${active.title}"? This cannot be undone.`,
      'Clear All'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.chatService.clearConversation(active.id).subscribe();
      }
    });
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private scrollToBottom(): void {
    try {
      if (this.messageScrollBox) {
        this.messageScrollBox.nativeElement.scrollTop = this.messageScrollBox.nativeElement.scrollHeight;
      }
    } catch { }
  }
}
