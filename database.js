const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// Путь к файлу БД. Сохраняем его в папке данных приложения
// Для простоты, пока будем использовать путь в корне проекта.
const dbPath = path.resolve(__dirname, 'tasks.sqlite');
let db;

function initDatabase() {
    try {
        // Открытие или создание файла БД
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL'); // Рекомендуемый режим для concurrency

        console.log('База данных успешно подключена:', dbPath);
        
        // ----------------------------------------------------
        // 1. Создание основных таблиц
        // ----------------------------------------------------
        db.exec(`
            -- Таблица Задач
            CREATE TABLE IF NOT EXISTS Tasks (
                TaskID INTEGER PRIMARY KEY AUTOINCREMENT,
                TitleRu TEXT NOT NULL,
                Condition TEXT,
                Idea TEXT,
                PolygonLink TEXT UNIQUE,
                Difficulty INTEGER CHECK(Difficulty BETWEEN 1 AND 10),
                IsCFReady BOOLEAN, -- Автозаполнение на основе PolygonLink
                IsYCReady BOOLEAN,
                Note TEXT
            );

            -- Таблица Контестов (Справочник)
            CREATE TABLE IF NOT EXISTS Contests (
                ContestID INTEGER PRIMARY KEY AUTOINCREMENT,
                TitleRu TEXT NOT NULL,
                Year INTEGER,
                UNIQUE(TitleRu, Year)
            );
            
            -- Таблица Тегов (Справочник)
            CREATE TABLE IF NOT EXISTS Tags (
                TagID INTEGER PRIMARY KEY AUTOINCREMENT,
                Title TEXT NOT NULL UNIQUE
            );

            -- Таблица Пользователей (для Аутентификации)
            CREATE TABLE IF NOT EXISTS Users (
                UserID INTEGER PRIMARY KEY AUTOINCREMENT,
                Username TEXT UNIQUE NOT NULL,
                PasswordHash TEXT NOT NULL, -- Будет хранить хэш
                Role TEXT NOT NULL CHECK(Role IN ('admin', 'user'))
            );
        `);

        // ----------------------------------------------------
        // 2. Создание связующих таблиц (Многие-ко-многим)
        // ----------------------------------------------------
        db.exec(`
            -- Связь Задача <> Контест
            CREATE TABLE IF NOT EXISTS TaskContest (
                TaskID INTEGER,
                ContestID INTEGER,
                PRIMARY KEY (TaskID, ContestID),
                FOREIGN KEY (TaskID) REFERENCES Tasks(TaskID) ON DELETE CASCADE,
                FOREIGN KEY (ContestID) REFERENCES Contests(ContestID) ON DELETE CASCADE
            );

            -- Связь Задача <> Тег
            CREATE TABLE IF NOT EXISTS TaskTag (
                TaskID INTEGER,
                TagID INTEGER,
                PRIMARY KEY (TaskID, TagID),
                FOREIGN KEY (TaskID) REFERENCES Tasks(TaskID) ON DELETE CASCADE,
                FOREIGN KEY (TagID) REFERENCES Tags(TagID) ON DELETE CASCADE
            );
        `);
        
        // ----------------------------------------------------
        // 3. Вставка Администратора по умолчанию (если нет)
        // ----------------------------------------------------
        // ВАЖНО: В реальном приложении пароль должен быть захэширован 
        // (например, с помощью bcrypt). Здесь для теста используем простой текст.
        const adminCheck = db.prepare("SELECT UserID FROM Users WHERE Username = 'admin'").get();
        if (!adminCheck) {
            const saltRounds = 10; // "Стоимость" хэширования
            const passwordHash = bcrypt.hashSync('password123', saltRounds);
            db.prepare("INSERT INTO Users (Username, PasswordHash, Role) VALUES (?, ?, ?)")
              .run('admin', passwordHash, 'admin');
            console.log("Администратор по умолчанию создан: admin / password123");
        }
        
        // ----------------------------------------------------
        // 4. Вставка Тестовых данных для справочников (если их нет)
        // ----------------------------------------------------
        const tagCheck = db.prepare("SELECT TagID FROM Tags LIMIT 1").get();
        if (!tagCheck) {
            console.log('Наполняем справочник тегов...');
            const tags = ['dp', 'graphs', 'strings', 'data structures', 'geometry', 'math', 'greedy', 'binary search'];
            const insertTag = db.prepare("INSERT INTO Tags (Title) VALUES (?)");
            const insertTags = db.transaction((tagsToInsert) => {
                for (const tag of tagsToInsert) insertTag.run(tag);
            });
            insertTags(tags);
        }

        const contestCheck = db.prepare("SELECT ContestID FROM Contests LIMIT 1").get();
        if (!contestCheck) {
            console.log('Наполняем справочник контестов...');
            const contests = [
                { title: 'Летняя школа по программированию', year: 2023 },
                { title: 'Зимняя школа по программированию', year: 2024 },
                { title: 'Отборочный контест', year: 2024 },
            ];
            const insertContest = db.prepare("INSERT INTO Contests (TitleRu, Year) VALUES (?, ?)");
            const insertContests = db.transaction((contestsToInsert) => {
                for (const contest of contestsToInsert) insertContest.run(contest.title, contest.year);
            });
            insertContests(contests);
        }

        console.log('Схема БД и данные по умолчанию готовы.');

    } catch (error) {
        console.error("Ошибка инициализации базы данных:", error.message);
        // В случае ошибки, закрываем приложение, т.к. работа с БД невозможна
        process.exit(1); 
    }
}

// ----------------------------------------------------
// Экспорт основных функций
// ----------------------------------------------------

/**
 * Получает все задачи с их тегами и контестами
 * @param {object} filters - Объект с фильтрами { minDifficulty, maxDifficulty, tags }
 * @returns {Array} Список объектов задач
 */
function getAllTasks(filters = {}) {
    const { minDifficulty, maxDifficulty, tags } = filters;
    let baseSql = `
        SELECT
            t.TaskID,
            t.TitleRu,
            t.Difficulty,
            t.PolygonLink,
            t.IsCFReady,
            t.IsYCReady,
            t.Condition,
            t.Idea,
            t.Note,
            -- Группируем ID и названия тегов в JSON-массив
            (
                SELECT json_group_array(json_object('TagID', tg.TagID, 'Title', tg.Title))
                FROM TaskTag tt
                JOIN Tags tg ON tt.TagID = tg.TagID
                WHERE tt.TaskID = t.TaskID
            ) as Tags,
            -- Группируем ID и названия контестов в JSON-массив
            (
                SELECT json_group_array(json_object('ContestID', c.ContestID, 'TitleRu', c.TitleRu))
                FROM TaskContest tc
                JOIN Contests c ON tc.ContestID = c.ContestID
                WHERE tc.TaskID = t.TaskID
            ) as Contests
        FROM Tasks t
    `;

    const whereClauses = [];
    const params = [];

    if (minDifficulty && !isNaN(minDifficulty)) {
        whereClauses.push('t.Difficulty >= ?');
        params.push(minDifficulty);
    }

    if (maxDifficulty && !isNaN(maxDifficulty)) {
        whereClauses.push('t.Difficulty <= ?');
        params.push(maxDifficulty);
    }

    if (tags && tags.length > 0) {
        // Убедимся, что задача содержит ВСЕ указанные теги
        const placeholders = tags.map(() => '?').join(',');
        whereClauses.push(`
            (SELECT COUNT(DISTINCT tt.TagID) 
             FROM TaskTag tt 
             WHERE tt.TaskID = t.TaskID AND tt.TagID IN (${placeholders})) = ?
        `);
        params.push(...tags, tags.length);
    }

    if (whereClauses.length > 0) {
        baseSql += ' WHERE ' + whereClauses.join(' AND ');
    }

    return db.prepare(baseSql).all(...params);
}

/**
 * Проверяет учетные данные пользователя.
 * @param {string} username Имя пользователя
 * @param {string} password Пароль
 * @returns {{success: boolean, role?: string, message?: string}} Результат входа
 */
function loginUser(username, password) {
    try {
        const user = db.prepare("SELECT * FROM Users WHERE Username = ?").get(username);
        if (!user) {
            return { success: false, message: 'Пользователь не найден.' };
        }

        const passwordIsValid = bcrypt.compareSync(password, user.PasswordHash);

        if (passwordIsValid) {
            return { success: true, role: user.Role };
        } else {
            return { success: false, message: 'Неверный пароль.' };
        }
    } catch (error) {
        console.error('Ошибка при попытке входа:', error.message);
        return { success: false, message: 'Ошибка базы данных.' };
    }
}

/**
 * Получает все теги из справочника.
 * @returns {Array} Список объектов тегов
 */
function getAllTags() {
    return db.prepare("SELECT * FROM Tags ORDER BY Title").all();
}

/**
 * Получает все контесты из справочника.
 * @returns {Array} Список объектов контестов
 */
function getAllContests() {
    return db.prepare("SELECT * FROM Contests ORDER BY TitleRu").all();
}

/**
 * Добавляет новую задачу и её связи.
 * @param {object} taskData Данные задачи { title, difficulty, link, tags, contests }
 * @returns {{success: boolean, message: string}}
 */
function addTask(taskData) {
    // --- DEBUG LOG ---
    // Этот лог поможет нам увидеть, какие именно данные приходят с фронтенда.
    console.log('Получены данные для добавления задачи:', taskData);
    // --- END DEBUG LOG ---

    // Используем транзакцию для атомарности операции
    const transaction = db.transaction((data) => {
        // --- УЛУЧШЕННАЯ ВАЛИДАЦИЯ И ДЕФОЛТНЫЕ ЗНАЧЕНИЯ ---
        // Это защитит нас от ошибки, если какое-то из полей придет как undefined.
        const {
            title = '',
            link = '',
            condition = '',
            idea = '',
            note = '',
            isYCReady = false,
            tags = [],
            contests = []
        } = data;
        let { difficulty } = data;

        // Преобразуем сложность в число. Если значение некорректно (например, пустая строка или undefined),
        // оно станет null. SQLite корректно обработает null для числового поля.
        const difficultyNum = parseInt(difficulty, 10);
        difficulty = !isNaN(difficultyNum) ? difficultyNum : null;

        // 1. Вставляем основную запись о задаче
        // ВАЖНО: better-sqlite3 не принимает boolean. Конвертируем в 1 или 0.
        const isCFReady = link ? link.includes('codeforces.com') : false;

        const info = db.prepare(
            'INSERT INTO Tasks (TitleRu, Difficulty, PolygonLink, IsCFReady, IsYCReady, Condition, Idea, Note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(title, difficulty, link, isCFReady ? 1 : 0, isYCReady ? 1 : 0, condition, idea, note);

        const newTaskId = info.lastInsertRowid;

        // 2. Вставляем связи с тегами
        const insertTag = db.prepare('INSERT INTO TaskTag (TaskID, TagID) VALUES (?, ?)');
        for (const tagId of tags) {
            if (typeof tagId === 'number') insertTag.run(newTaskId, tagId);
        }

        // 3. Вставляем связи с контестами
        const insertContest = db.prepare('INSERT INTO TaskContest (TaskID, ContestID) VALUES (?, ?)');
        for (const contestId of contests) {
            if (typeof contestId === 'number') insertContest.run(newTaskId, contestId);
        }
        return newTaskId;
    });

    try {
        transaction(taskData || {}); // Передаем пустой объект, если taskData вообще не пришел
        return { success: true, message: 'Задача успешно добавлена.' };
    } catch (error) {
        console.error('Ошибка при добавлении задачи:', error.message);
        if (error.message.includes('UNIQUE constraint failed: Tasks.PolygonLink')) {
            return { success: false, message: 'Задача с такой ссылкой на Polygon уже существует.' };
        }
        return { success: false, message: `Не удалось добавить задачу: ${error.message}.` };
    }
}

/**
 * Получает одну задачу по её ID со всеми связями.
 * @param {number} taskId ID задачи
 * @returns {object | undefined} Объект задачи или undefined, если не найдена
 */
function getTaskById(taskId) {
    const sql = `
        SELECT
            t.TaskID,
            t.TitleRu,
            t.Difficulty,
            t.PolygonLink,
            t.IsCFReady,
            t.IsYCReady,
            t.Condition,
            t.Idea,
            t.Note,
            -- Группируем ID тегов в JSON-массив
            (
                SELECT json_group_array(tt.TagID)
                FROM TaskTag tt
                WHERE tt.TaskID = t.TaskID
            ) as TagIDs,
            -- Группируем ID контестов в JSON-массив
            (
                SELECT json_group_array(tc.ContestID)
                FROM TaskContest tc
                WHERE tc.TaskID = t.TaskID
            ) as ContestIDs
        FROM Tasks t
        WHERE t.TaskID = ?
    `;
    const task = db.prepare(sql).get(taskId);
    if (task) {
        // SQLite возвращает JSON как строки, парсим их
        if (task.TagIDs) task.TagIDs = JSON.parse(task.TagIDs);
        if (task.ContestIDs) task.ContestIDs = JSON.parse(task.ContestIDs);
    }
    return task;
}

/**
 * Обновляет существующую задачу.
 * @param {number} taskId ID задачи для обновления
 * @param {object} taskData Новые данные задачи
 * @returns {{success: boolean, message: string}}
 */
function updateTask(taskId, taskData) {
    console.log(`Обновление задачи ${taskId} с данными:`, taskData);
    const transaction = db.transaction((id, data) => {
        const {
            title = '',
            difficulty,
            link = '',
            condition = '',
            idea = '',
            note = '',
            isYCReady = false,
            tags = [],
            contests = []
        } = data;
        
        const difficultyNum = parseInt(difficulty, 10);
        const finalDifficulty = !isNaN(difficultyNum) ? difficultyNum : null;
        const isCFReady = link ? link.includes('codeforces.com') : false;

        // 1. Обновляем основную запись
        db.prepare(
            `UPDATE Tasks
             SET TitleRu = ?, Difficulty = ?, PolygonLink = ?, IsCFReady = ?, IsYCReady = ?, Condition = ?, Idea = ?, Note = ?
             WHERE TaskID = ?`
        ).run(title, finalDifficulty, link, isCFReady ? 1 : 0, isYCReady ? 1 : 0, condition, idea, note, id);

        // 2. Обновляем теги: удаляем старые, вставляем новые
        db.prepare('DELETE FROM TaskTag WHERE TaskID = ?').run(id);
        const insertTag = db.prepare('INSERT INTO TaskTag (TaskID, TagID) VALUES (?, ?)');
        for (const tagId of tags) {
            if (typeof tagId === 'number') insertTag.run(id, tagId);
        }

        // 3. Обновляем контесты: удаляем старые, вставляем новые
        db.prepare('DELETE FROM TaskContest WHERE TaskID = ?').run(id);
        const insertContest = db.prepare('INSERT INTO TaskContest (TaskID, ContestID) VALUES (?, ?)');
        for (const contestId of contests) {
            if (typeof contestId === 'number') insertContest.run(id, contestId);
        }
    });

    try {
        transaction(taskId, taskData);
        return { success: true, message: 'Задача успешно обновлена.' };
    } catch (error) {
        console.error(`Ошибка при обновлении задачи ${taskId}:`, error.message);
        if (error.message.includes('UNIQUE constraint failed: Tasks.PolygonLink')) {
            return { success: false, message: 'Задача с такой ссылкой на Polygon уже существует.' };
        }
        return { success: false, message: `Не удалось обновить задачу: ${error.message}` };
    }
}

/**
 * Удаляет задачу по её ID.
 * @param {number} taskId ID задачи для удаления
 * @returns {{success: boolean, message: string}}
 */
function deleteTask(taskId) {
    try {
        const info = db.prepare('DELETE FROM Tasks WHERE TaskID = ?').run(taskId);
        if (info.changes > 0) {
            return { success: true, message: 'Задача успешно удалена.' };
        } else {
            return { success: false, message: 'Задача с таким ID не найдена.' };
        }
    } catch (error) {
        console.error(`Ошибка при удалении задачи ${taskId}:`, error.message);
        return { success: false, message: `Не удалось удалить задачу: ${error.message}` };
    }
}

/**
 * Добавляет новый тег.
 * @param {string} title Название тега
 * @returns {{success: boolean, message: string}}
 */
function addTag(title) {
    try {
        db.prepare('INSERT INTO Tags (Title) VALUES (?)').run(title);
        return { success: true, message: 'Тег успешно добавлен.' };
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return { success: false, message: 'Тег с таким названием уже существует.' };
        }
        return { success: false, message: `Не удалось добавить тег: ${error.message}` };
    }
}

/**
 * Обновляет тег.
 * @param {number} tagId ID тега
 * @param {string} newTitle Новое название
 * @returns {{success: boolean, message: string}}
 */
function updateTag(tagId, newTitle) {
    try {
        const info = db.prepare('UPDATE Tags SET Title = ? WHERE TagID = ?').run(newTitle, tagId);
        if (info.changes > 0) {
            return { success: true, message: 'Тег успешно обновлен.' };
        }
        return { success: false, message: 'Тег не найден.' };
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return { success: false, message: 'Тег с таким названием уже существует.' };
        }
        return { success: false, message: `Не удалось обновить тег: ${error.message}` };
    }
}

/**
 * Удаляет тег.
 * @param {number} tagId ID тега
 * @returns {{success: boolean, message: string}}
 */
function deleteTag(tagId) {
    try {
        const info = db.prepare('DELETE FROM Tags WHERE TagID = ?').run(tagId);
        if (info.changes > 0) {
            return { success: true, message: 'Тег успешно удален.' };
        }
        return { success: false, message: 'Тег не найден.' };
    } catch (error) {
        return { success: false, message: `Не удалось удалить тег: ${error.message}` };
    }
}

/**
 * Добавляет новый контест.
 * @param {string} title Название
 * @param {number} year Год
 * @returns {{success: boolean, message: string}}
 */
function addContest(title, year) {
    try {
        db.prepare('INSERT INTO Contests (TitleRu, Year) VALUES (?, ?)')
          .run(title, year);
        return { success: true, message: 'Контест успешно добавлен.' };
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return { success: false, message: 'Контест с таким названием и годом уже существует.' };
        }
        return { success: false, message: `Не удалось добавить контест: ${error.message}` };
    }
}

/**
 * Обновляет контест.
 * @param {number} contestId ID
 * @param {string} newTitle Новое название
 * @param {number} newYear Новый год
 * @returns {{success: boolean, message: string}}
 */
function updateContest(contestId, newTitle, newYear) {
    try {
        const info = db.prepare('UPDATE Contests SET TitleRu = ?, Year = ? WHERE ContestID = ?')
          .run(newTitle, newYear, contestId);
        if (info.changes > 0) {
            return { success: true, message: 'Контест успешно обновлен.' };
        }
        return { success: false, message: 'Контест не найден.' };
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return { success: false, message: 'Контест с таким названием и годом уже существует.' };
        }
        return { success: false, message: `Не удалось обновить контест: ${error.message}` };
    }
}

/**
 * Удаляет контест.
 * @param {number} contestId ID
 * @returns {{success: boolean, message: string}}
 */
function deleteContest(contestId) {
    try {
        const info = db.prepare('DELETE FROM Contests WHERE ContestID = ?').run(contestId);
        if (info.changes > 0) {
            return { success: true, message: 'Контест успешно удален.' };
        } else {
            return { success: false, message: 'Контест с таким ID не найден.' };
        }
    } catch (error) {
        return { success: false, message: `Не удалось удалить контест: ${error.message}` };
    }
}

/**
 * Проверяет уникальность ссылки на Polygon.
 * @param {string} link Ссылка для проверки
 * @param {number|null} currentTaskId ID текущей задачи (для исключения ее из проверки при редактировании)
 * @returns {{isUnique: boolean}}
 */
function checkLinkUniqueness(link, currentTaskId = null) {
    try {
        let sql = 'SELECT TaskID FROM Tasks WHERE PolygonLink = ?';
        const params = [link];
        if (currentTaskId) {
            sql += ' AND TaskID != ?';
            params.push(currentTaskId);
        }
        const task = db.prepare(sql).get(...params);
        return { isUnique: !task };
    } catch (error) {
        console.error('Ошибка при проверке уникальности ссылки:', error);
        // В случае ошибки считаем, что она не уникальна, чтобы предотвратить ошибку сохранения
        return { isUnique: false };
    }
}

/**
 * Обновляет пароль администратора.
 * @param {string} oldPassword Старый пароль
 * @param {string} newPassword Новый пароль
 * @returns {{success: boolean, message: string}}
 */
function updateAdminPassword(oldPassword, newPassword) {
    try {
        const adminUser = db.prepare("SELECT * FROM Users WHERE Username = 'admin'").get();
        if (!adminUser) {
            return { success: false, message: 'Пользователь "admin" не найден.' };
        }

        const oldPasswordIsValid = bcrypt.compareSync(oldPassword, adminUser.PasswordHash);
        if (!oldPasswordIsValid) {
            return { success: false, message: 'Старый пароль неверен.' };
        }

        if (!newPassword || newPassword.length < 6) {
            return { success: false, message: 'Новый пароль должен содержать не менее 6 символов.' };
        }

        const saltRounds = 10;
        const newPasswordHash = bcrypt.hashSync(newPassword, saltRounds);

        const info = db.prepare("UPDATE Users SET PasswordHash = ? WHERE Username = 'admin'").run(newPasswordHash);

        if (info.changes > 0) {
            return { success: true, message: 'Пароль успешно обновлен.' };
        }
        return { success: false, message: 'Не удалось обновить пароль в базе данных.' };
    } catch (error) {
        console.error('Ошибка при обновлении пароля:', error.message);
        return { success: false, message: `Ошибка базы данных: ${error.message}` };
    }
}

module.exports = {
    initDatabase,
    getAllTasks,
    loginUser,
    getAllTags,
    getAllContests,
    addTask,
    getTaskById,
    updateTask,
    deleteTask,
    addTag,
    updateTag,
    deleteTag,
    addContest,
    updateContest,
    deleteContest,
    checkLinkUniqueness,
    updateAdminPassword,
};