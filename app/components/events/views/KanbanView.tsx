'use client';

import React, { useState, useEffect } from "react";
import { useEvents, groupEventsByStatus, Event, EventStatus } from "@/contexts/EventContext";
import { KanbanColumn } from "@/components/events/views/KanbanColumn";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

// 添加自定義 CSS 樣式，使拖曳更流暢
const kanbanStyles = `
  .kanban-card {
    transform-origin: center;
    transition: transform 0.2s, opacity 0.2s, border 0.15s, box-shadow 0.15s;
  }
  
  .kanban-card:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  .kanban-card:active {
    cursor: grabbing;
    transform: scale(1.02);
  }
  
  .drop-indicator-top {
    border-top: 3px solid #3b82f6;
    padding-top: 4px;
    margin-top: -4px;
  }
  
  .drop-indicator-bottom {
    border-bottom: 3px solid #3b82f6;
    padding-bottom: 4px;
    margin-bottom: -4px;
  }
  
  .drag-over {
    background-color: #f5f7fc;
  }
`;

export function KanbanView() {
  const { events, updateEvent } = useEvents();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  // 狀態鍵值映射
  const statusMapping: Record<string, EventStatus> = {
    'to_do': 'to_do',
    'in_progress': 'in_progress',
    'done': 'done'
  };
  
  // 將狀態鍵值轉換為標準格式並根據 position 排序
  const normalizedEvents = [...events]
    .map(event => ({
      ...event,
      status: statusMapping[event.status] || event.status
    }))
    .sort((a, b) => a.position - b.position);
  
  // 狀態來儲存已排序的事件
  const [sortedEvents, setSortedEvents] = useState<Event[]>(normalizedEvents);
  
  // 當events變化時更新sortedEvents
  useEffect(() => {
    const sorted = [...events]
      .map(event => ({
        ...event,
        status: statusMapping[event.status] || event.status
      }))
      .sort((a, b) => a.position - b.position);
    setSortedEvents(sorted);
  }, [events]);
  
  // 使用排序後的事件建立列
  const generateColumns = () => {
    return [
      {
        id: 'to_do',
        name: t('to_do'),
        events: sortedEvents.filter(event => event.status === 'to_do')
      },
      {
        id: 'in_progress',
        name: t('events_in_progress'),
        events: sortedEvents.filter(event => event.status === 'in_progress')
      },
      {
        id: 'done',
        name: t('done'),
        events: sortedEvents.filter(event => event.status === 'done')
      }
    ];
  };
  
  const columns = generateColumns();
  const [isDragging, setIsDragging] = useState(false);
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [draggedSourceColumn, setDraggedSourceColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [dragOverEventId, setDragOverEventId] = useState<string | null>(null);
  
  // 插入樣式
  useEffect(() => {
    // 添加樣式到 document head
    const styleElement = document.createElement('style');
    styleElement.innerHTML = kanbanStyles;
    document.head.appendChild(styleElement);
    
    // 清除函數，移除樣式
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const handleDragStart = (e: React.DragEvent, eventId: string, sourceColumn: string) => {
    e.dataTransfer.setData("eventId", eventId);
    e.dataTransfer.setData("sourceColumn", sourceColumn);
    e.dataTransfer.effectAllowed = "move";
    
    // Make drag more natural
    if (e.target instanceof HTMLElement) {
      // 獲取原始卡片元素，而不僅僅是拖曳把手
      const card = e.target.closest(".kanban-card");
      if (card && card instanceof HTMLElement) {
        const rect = card.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setDragImage(card, offsetX, offsetY);
      }
    }
    
    setIsDragging(true);
    setDraggedEventId(eventId);
    setDraggedSourceColumn(sourceColumn);
    
    // Small delay to allow animation to start
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        const card = e.target.closest(".kanban-card");
        if (card) {
          card.classList.add('opacity-50', 'scale-95');
        }
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    setDraggedEventId(null);
    setDraggedSourceColumn(null);
    setDragOverColumn(null);
    setDragOverEventId(null);
    setDragPosition(null);
    
    // 清理所有拖曳相關的樣式類
    document.querySelectorAll('.opacity-50, .scale-95').forEach(el => {
      el.classList.remove('opacity-50', 'scale-95');
    });
    
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    
    document.querySelectorAll('.drop-indicator-top, .drop-indicator-bottom').forEach(el => {
      el.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
    });
  };

  const handleDragOver = (e: React.DragEvent, columnId: string, eventId?: string, position?: 'top' | 'bottom') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
    
    // Update position for intra-column sorting
    if (eventId && eventId !== draggedEventId) {
      setDragOverEventId(eventId);
      if (position) {
        setDragPosition(position === 'top' ? 0 : 1);
      }
      
      if (e.currentTarget) {
        const allCards = document.querySelectorAll('.kanban-card');
        // 移除所有卡片上的位置指示器
        allCards.forEach(card => {
          card.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
        });
        
        // 為當前目標卡片添加位置指示器
        const targetCard = e.currentTarget.closest('.kanban-card');
        if (targetCard) {
          if (position === 'top') {
            targetCard.classList.add('drop-indicator-top');
          } else if (position === 'bottom') {
            targetCard.classList.add('drop-indicator-bottom');
          }
        }
      }
    } else {
      setDragOverEventId(null);
      setDragPosition(null);
    }
    
    // Provide visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      document.querySelectorAll('.drag-over').forEach(el => {
        if (el !== e.currentTarget) {
          el.classList.remove('drag-over');
        }
      });
      
      const column = e.currentTarget.closest('.kanban-column');
      if (column) {
        column.classList.add('drag-over');
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetColumn: string, targetEventId?: string, position?: 'top' | 'bottom') => {
    e.preventDefault();
    
    // 從資料傳輸物件中獲取被拖曳的事件ID和來源列
    const eventId = e.dataTransfer.getData("eventId");
    const sourceColumn = e.dataTransfer.getData("sourceColumn");
    
    // 找出被拖曳的事件
    const draggedEvent = sortedEvents.find(event => event.id === eventId);
    if (!draggedEvent) return;
    
    // 創建所有事件的副本
    const updatedEvents = [...sortedEvents];
    
    // 從事件列表中移除被拖曳的事件（我們稍後會在新位置添加它）
    const eventsWithoutDragged = updatedEvents.filter(e => e.id !== eventId);
    
    // 根據目標列更新事件狀態
    const updatedEvent = {
      ...draggedEvent,
      status: sourceColumn !== targetColumn 
        ? (statusMapping[targetColumn] || targetColumn as EventStatus)
        : draggedEvent.status
    };
    
    // 精確定位放置位置的處理邏輯
    let inserted = false;
    let eventsWithDraggedInserted = [...eventsWithoutDragged];
    
    // 情況1: 拖曳到特定事件的上方或下方
    if (targetEventId && targetEventId !== eventId) {
      const targetIndex = eventsWithoutDragged.findIndex(e => e.id === targetEventId);
      
      if (targetIndex !== -1) {
        // 嚴格按照放置位置插入（上方或下方）
        const insertIndex = position === 'bottom' ? targetIndex + 1 : targetIndex;
        eventsWithDraggedInserted.splice(insertIndex, 0, updatedEvent);
        inserted = true;
      }
    }
    
    // 情況2: 拖曳到列的空白區域但可能有已保存的dragOverEventId和dragPosition
    if (!inserted && dragOverEventId && dragPosition !== null) {
      const targetIndex = eventsWithoutDragged.findIndex(e => e.id === dragOverEventId);
      
      if (targetIndex !== -1) {
        const insertIndex = dragPosition === 1 ? targetIndex + 1 : targetIndex;
        eventsWithDraggedInserted.splice(insertIndex, 0, updatedEvent);
        inserted = true;
      }
    }
    
    // 情況3: 拖曳到列的空白區域且沒有特定目標卡片
    if (!inserted) {
      // 獲取目標列中所有事件
      const targetColumnEvents = eventsWithoutDragged.filter(
        e => e.status === (statusMapping[targetColumn] || targetColumn as EventStatus)
      );
      
      if (targetColumnEvents.length === 0) {
        // 如果列為空，直接添加
        eventsWithDraggedInserted.push(updatedEvent);
      } else {
        // 根據滑鼠位置確定插入點
        if (e.currentTarget instanceof HTMLElement) {
          const columnRect = e.currentTarget.getBoundingClientRect();
          const mouseY = e.clientY;
          
          // 找出最接近滑鼠Y位置的卡片
          const columnCards = Array.from(e.currentTarget.querySelectorAll('.kanban-card'))
            .filter(card => !card.classList.contains('opacity-50')); // 排除被拖曳的卡片本身
          
          if (columnCards.length > 0) {
            let closestCard: Element | null = null;
            let closestDistance = Infinity;
            let insertBefore = true;
            
            // 尋找最接近滑鼠位置的卡片
            for (const card of columnCards) {
              const cardRect = card.getBoundingClientRect();
              const cardMiddleY = cardRect.top + cardRect.height / 2;
              const distance = Math.abs(mouseY - cardMiddleY);
              
              if (distance < closestDistance) {
                closestDistance = distance;
                closestCard = card;
                insertBefore = mouseY < cardMiddleY;
              }
            }
            
            if (closestCard && closestCard instanceof HTMLElement) {
              const cardId = closestCard.getAttribute('data-event-id');
              if (cardId) {
                const cardIndex = eventsWithoutDragged.findIndex(e => e.id === cardId);
                if (cardIndex !== -1) {
                  const insertIndex = insertBefore ? cardIndex : cardIndex + 1;
                  eventsWithDraggedInserted.splice(insertIndex, 0, updatedEvent);
                  inserted = true;
                }
              }
            }
          }
          
          if (!inserted) {
            // 使用相對位置在列中定位
            const relativePosition = (mouseY - columnRect.top) / columnRect.height;
            
            if (relativePosition <= 0.33) {
              // 插入到列頭
              const firstEventIndex = eventsWithoutDragged.findIndex(
                e => e.status === (statusMapping[targetColumn] || targetColumn as EventStatus)
              );
              
              if (firstEventIndex !== -1) {
                eventsWithDraggedInserted.splice(firstEventIndex, 0, updatedEvent);
              } else {
                eventsWithDraggedInserted.push(updatedEvent);
              }
            } else if (relativePosition >= 0.66) {
              // 插入到列尾
              eventsWithDraggedInserted.push(updatedEvent);
            } else {
              // 插入到列中間
              const targetColumnIndices = eventsWithoutDragged
                .map((e, index) => e.status === (statusMapping[targetColumn] || targetColumn as EventStatus) ? index : -1)
                .filter(index => index !== -1);
              
              if (targetColumnIndices.length > 0) {
                const middleIndex = Math.floor(targetColumnIndices.length / 2);
                const insertIndex = targetColumnIndices[middleIndex];
                eventsWithDraggedInserted.splice(insertIndex, 0, updatedEvent);
              } else {
                eventsWithDraggedInserted.push(updatedEvent);
              }
            }
          }
        } else {
          // 無法確定位置，默認插入到列尾
          eventsWithDraggedInserted.push(updatedEvent);
        }
      }
    }
    
    // 為每個列重新計算 position 值，確保它們是按順序排列的（從1開始）
    const updatedPositions: Record<string, Event[]> = {
      to_do: [],
      in_progress: [],
      done: []
    };
    
    // 先將事件分組到各自的列中（包括已插入的拖曳事件）
    eventsWithDraggedInserted.forEach(event => {
      const status = event.status as EventStatus;
      if (updatedPositions[status]) {
        updatedPositions[status].push(event);
      }
    });
    
    // 然後為每一列中的事件分配新的 position 值
    const eventsWithUpdatedPositions: Event[] = [];
    
    Object.entries(updatedPositions).forEach(([status, statusEvents]) => {
      statusEvents.forEach((event, index) => {
        eventsWithUpdatedPositions.push({
          ...event,
          position: index + 1 // position 從 1 開始
        });
      });
    });
    
    // 更新排序狀態（這將更新UI）- 先進行UI更新
    setSortedEvents(eventsWithUpdatedPositions);
    
    // 找出需要更新的事件（狀態或位置有變化的）
    const eventsToUpdate = eventsWithUpdatedPositions.filter(e => {
      const originalEvent = events.find(orig => orig.id === e.id);
      return (
        !originalEvent || 
        originalEvent.status !== e.status || 
        originalEvent.position !== e.position
      );
    });
    
    // 批量更新資料庫中受影響的事件
    eventsToUpdate.forEach(eventToUpdate => {
      try {
        updateEvent(eventToUpdate).catch(error => {
          console.error(`Failed to update event ${eventToUpdate.id}:`, error);
        });
      } catch (error) {
        console.error(`Error updating event ${eventToUpdate.id}:`, error);
      }
    });
    
    // 清理拖曳相關的視覺提示
    document.querySelectorAll('.drag-over, .drop-indicator-top, .drop-indicator-bottom').forEach(el => {
      el.classList.remove('drag-over', 'drop-indicator-top', 'drop-indicator-bottom');
    });
    
    // 重設所有拖曳相關狀態
    setIsDragging(false);
    setDraggedEventId(null);
    setDraggedSourceColumn(null);
    setDragOverColumn(null);
    setDragOverEventId(null);
    setDragPosition(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columns.map((column) => (
        <div
          key={column.id}
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDragLeave={(e) => {
            if (e.currentTarget instanceof HTMLElement) {
              // Only remove style when actually leaving the column
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                e.currentTarget.classList.remove('drag-over');
              }
            }
          }}
          onDrop={(e) => handleDrop(e, column.id)}
          className={`kanban-column flex flex-col h-full transition-colors duration-200 ${
            dragOverColumn === column.id && draggedSourceColumn !== column.id
              ? 'bg-gray-50 rounded-md' 
              : ''
          }`}
        >
          <KanbanColumn 
            column={column} 
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            isDragging={isDragging}
            draggedEventId={draggedEventId}
            draggedSourceColumn={draggedSourceColumn}
            dragOverColumn={dragOverColumn}
            dragOverEventId={dragOverEventId}
            dragPosition={dragPosition}
          />
        </div>
      ))}
    </div>
  );
} 