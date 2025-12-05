const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./database'); // 1. Импортируем модуль базы данных

let mainWindow;

function createWindow () {
  // 1. Создание основного окна
  mainWindow = new BrowserWindow({
    width: 1200, // Увеличим для сложного UI
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false, // Изначально не показывать, пока не будет готово к отображению
    webPreferences: {
      // Подключение Preload скрипта для безопасной работы с Node.js/IPC
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Рекомендуемый безопасный режим
      nodeIntegration: false 
    }
  });

  // 2. Загрузка основного HTML-файла
  mainWindow.loadFile('index.html');

  // 3. Показать окно, когда оно готово
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // mainWindow.webContents.openDevTools(); // Раскомментируйте для отладки
  });

  // 4. Настройка нативного меню (необязательно, но полезно)
  setupMenu();
}

// Вызываем функцию создания окна, когда Electron готов
app.whenReady().then(() => {
  // 2. Получаем путь к папке данных пользователя и инициализируем БД
  const userDataPath = app.getPath('userData');
  db.initDatabase(userDataPath);
  createWindow();
});

// Закрытие приложения при закрытии всех окон (кроме macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // На macOS пересоздаем окно в приложении, когда иконка дока нажата
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Настройка пустого или пользовательского меню
function setupMenu() {
    // В настольных приложениях принято убирать стандартное меню для чистоты
    Menu.setApplicationMenu(null); 
    
    // Если нужно меню отладки, можно его добавить:
    // const template = [
    //     {
    //         label: 'View',
    //         submenu: [
    //             { role: 'reload' },
    //             { role: 'forceReload' },
    //             { role: 'toggledevtools' }
    //         ]
    //     }
    // ];
    // const menu = Menu.buildFromTemplate(template);
    // Menu.setApplicationMenu(menu);
}

// ---------------------------------------------
// Логика IPC для взаимодействия с базой данных
// ---------------------------------------------
ipcMain.handle('db:get-all-tasks', async (event, filters) => {
  return db.getAllTasks(filters);
});

ipcMain.handle('db:login', async (event, { username, password }) => {
  return db.loginUser(username, password);
});

ipcMain.handle('db:get-all-tags', async () => {
  return db.getAllTags();
});

ipcMain.handle('db:get-all-contests', async () => {
  return db.getAllContests();
});

ipcMain.handle('db:add-task', async (event, taskData) => {
  return db.addTask(taskData);
});

ipcMain.handle('db:get-task-by-id', async (event, taskId) => {
  return db.getTaskById(taskId);
});

ipcMain.handle('db:update-task', async (event, { taskId, taskData }) => {
  return db.updateTask(taskId, taskData);
});

ipcMain.handle('db:delete-task', async (event, taskId) => {
  return db.deleteTask(taskId);
});

ipcMain.handle('db:check-link-uniqueness', async (event, { link, currentTaskId }) => {
  return db.checkLinkUniqueness(link, currentTaskId);
});

// IPC для управления справочниками
ipcMain.handle('db:add-tag', async (event, title) => db.addTag(title));
ipcMain.handle('db:update-tag', async (event, { id, title }) => db.updateTag(id, title));
ipcMain.handle('db:delete-tag', async (event, id) => db.deleteTag(id));

ipcMain.handle('db:add-contest', async (event, { title, year }) => db.addContest(title, year));
ipcMain.handle('db:update-contest', async (event, { id, title, year }) => db.updateContest(id, title, year));
ipcMain.handle('db:delete-contest', async (event, id) => db.deleteContest(id));

// IPC для сохранения отчета
ipcMain.handle('db:save-report', async (event, content) => {
  if (!mainWindow) {
    return { success: false, message: 'Главное окно не найдено.' };
  }

  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Сохранить отчет',
      defaultPath: `tasks-report-${Date.now()}.csv`,
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, message: 'Сохранение отменено.' };
    }

    // Добавляем BOM для корректного отображения кириллицы в Excel
    const bom = '\uFEFF';
    fs.writeFileSync(filePath, bom + content, 'utf8');

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Ошибка сохранения отчета:', error);
    return { success: false, message: `Не удалось сохранить файл: ${error.message}` };
  }
});

// IPC для кастомного диалога подтверждения
ipcMain.handle('app:show-confirm-dialog', async (event, message) => {
  if (!mainWindow) return false;

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Отмена', 'Удалить'],
    defaultId: 1, // Индекс кнопки по умолчанию
    cancelId: 0, // Индекс кнопки отмены
    title: 'Предупреждение',
    message: message,
  });
  return result.response === 1; // Возвращает true, если нажата кнопка "Удалить"
});

ipcMain.handle('app:update-admin-password', async (event, { oldPassword, newPassword }) => {
  return db.updateAdminPassword(oldPassword, newPassword);
});