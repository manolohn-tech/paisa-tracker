/**
 * db.js — IndexedDB Database Layer
 * Handles all persistent storage for Paisa AI Expense Tracker
 */

const DB = (() => {
  const DB_NAME    = 'PaisaTrackerDB';
  const DB_VERSION = 1;
  let dbInstance   = null;

  // Open / create the database
  const open = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Expenses store
      if (!db.objectStoreNames.contains('expenses')) {
        const expStore = db.createObjectStore('expenses', {
          keyPath: 'id',
          autoIncrement: true
        });
        expStore.createIndex('date',     'date',     { unique: false });
        expStore.createIndex('category', 'category', { unique: false });
        expStore.createIndex('monthKey', 'monthKey', { unique: false });
      }

      // Budgets store (one entry per month)
      if (!db.objectStoreNames.contains('budgets')) {
        db.createObjectStore('budgets', { keyPath: 'monthKey' });
      }

      // Student profile
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'key' });
      }
    };

    request.onsuccess  = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
    request.onerror    = ()  => reject(new Error('Failed to open IndexedDB: ' + request.error));
    request.onblocked  = ()  => reject(new Error('IndexedDB is blocked by another tab'));
  });

  // Helper: run a transaction
  const runTx = (storeNames, mode, fn) => new Promise((resolve, reject) => {
    if (!dbInstance) { reject(new Error('DB not initialized')); return; }
    const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
    const tx  = dbInstance.transaction(stores, mode);
    const req = fn(tx);
    if (req && req.onsuccess !== undefined) {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    } else {
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    }
  });

  // CRUD operations
  const getAll = (store) =>
    runTx(store, 'readonly', (tx) => tx.objectStore(store).getAll());

  const getByIndex = (store, indexName, value) =>
    new Promise((resolve, reject) => {
      if (!dbInstance) { reject(new Error('DB not initialized')); return; }
      const tx    = dbInstance.transaction(store, 'readonly');
      const index = tx.objectStore(store).index(indexName);
      const req   = index.getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });

  const add = (store, obj) =>
    runTx(store, 'readwrite', (tx) => tx.objectStore(store).add(obj));

  const put = (store, obj) =>
    runTx(store, 'readwrite', (tx) => tx.objectStore(store).put(obj));

  const remove = (store, key) =>
    runTx(store, 'readwrite', (tx) => tx.objectStore(store).delete(key));

  const clear = (store) =>
    runTx(store, 'readwrite', (tx) => tx.objectStore(store).clear());

  const count = (store) =>
    runTx(store, 'readonly', (tx) => tx.objectStore(store).count());

  return { open, getAll, getByIndex, add, put, remove, clear, count };
})();
