import { useState, useEffect, useCallback } from 'react';
import { Store } from '@tauri-apps/plugin-store';

const STORE_PATH = 'recent-files.json';
const MAX_RECENT_ITEMS = 10;

let store: Store | null = null;

async function getStore() {
  if (!store) {
    store = await Store.load(STORE_PATH);
  }
  return store;
}

export interface RecentItem {
  path: string;
  name: string;
  isDirectory: boolean;
  timestamp: number;
}

export function useRecentFiles() {
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load recent items from store
  useEffect(() => {
    async function loadRecentItems() {
      try {
        const storeInstance = await getStore();
        const items = await storeInstance.get<RecentItem[]>('items');
        if (items && Array.isArray(items)) {
          // Sort by timestamp (most recent first) and limit to MAX_RECENT_ITEMS
          const sorted = items
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, MAX_RECENT_ITEMS);
          setRecentItems(sorted);
        }
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load recent files:', error);
        setIsLoaded(true);
      }
    }

    loadRecentItems();
  }, []);

  // Add a new item to recent files
  const addRecentItem = useCallback(async (path: string, isDirectory: boolean) => {
    try {
      const parts = path.split(/[/\\]/);
      const name = parts[parts.length - 1] || path;
      
      const newItem: RecentItem = {
        path,
        name,
        isDirectory,
        timestamp: Date.now(),
      };

      setRecentItems(prev => {
        // Remove if already exists
        const filtered = prev.filter(item => item.path !== path);
        // Add new item at the beginning
        const updated = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS);
        
        // Save to store asynchronously
        (async () => {
          try {
            const storeInstance = await getStore();
            await storeInstance.set('items', updated);
            await storeInstance.save();
          } catch (error) {
            console.error('Failed to save recent items:', error);
          }
        })();
        
        return updated;
      });
    } catch (error) {
      console.error('Failed to add recent item:', error);
    }
  }, []);

  // Clear all recent items
  const clearRecentItems = useCallback(async () => {
    try {
      setRecentItems([]);
      const storeInstance = await getStore();
      await storeInstance.set('items', []);
      await storeInstance.save();
    } catch (error) {
      console.error('Failed to clear recent items:', error);
    }
  }, []);

  return {
    recentItems,
    isLoaded,
    addRecentItem,
    clearRecentItems,
  };
}

