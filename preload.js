const { contextBridge, ipcRenderer } = require('electron');

// Создаем безопасный мост между процессом рендеринга (UI) и основным процессом (Node.js)
contextBridge.exposeInMainWorld(
  // Имя, под которым API будет доступно в window (например, window.db)
  'db',
  {
    // Определяем функцию, которую сможет вызвать UI.
    // Она асинхронно вызывает обработчик 'db:get-all-tasks' в main.js
    getAllTasks: (filters) => ipcRenderer.invoke('db:get-all-tasks', filters),
    
    // Функция для входа в систему
    login: (username, password) => ipcRenderer.invoke('db:login', { username, password }),

    // Функции для работы с задачами и справочниками
    getAllTags: () => ipcRenderer.invoke('db:get-all-tags'),
    getAllContests: () => ipcRenderer.invoke('db:get-all-contests'),
    addTask: (taskData) => ipcRenderer.invoke('db:add-task', taskData),

    checkLinkUniqueness: (link, currentTaskId) => ipcRenderer.invoke('db:check-link-uniqueness', { link, currentTaskId }),
    getTaskById: (taskId) => ipcRenderer.invoke('db:get-task-by-id', taskId),
    updateTask: (taskId, taskData) => ipcRenderer.invoke('db:update-task', { taskId, taskData }),
    deleteTask: (taskId) => ipcRenderer.invoke('db:delete-task', taskId),

    // Управление справочниками
    addTag: (title) => ipcRenderer.invoke('db:add-tag', title),
    updateTag: (id, title) => ipcRenderer.invoke('db:update-tag', { id, title }),
    deleteTag: (id) => ipcRenderer.invoke('db:delete-tag', id),
    addContest: (title, year) => ipcRenderer.invoke('db:add-contest', { title, year }),
    updateContest: (id, title, year) => ipcRenderer.invoke('db:update-contest', { id, title, year }),
    deleteContest: (id) => ipcRenderer.invoke('db:delete-contest', id),

    // Новая функция для сохранения отчета
    saveReport: (content) => ipcRenderer.invoke('db:save-report', content),

    // Новая функция для диалога подтверждения
    showConfirmDialog: (message) => ipcRenderer.invoke('app:show-confirm-dialog', message),

    // Новая функция для информационного сообщения
    showAlert: (options) => ipcRenderer.invoke('app:show-alert', options),

    // Функция смены пароля
    updateAdminPassword: (oldPassword, newPassword) => ipcRenderer.invoke('app:update-admin-password', { oldPassword, newPassword }),
  }
);