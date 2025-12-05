document.addEventListener('DOMContentLoaded', () => { 
    /**
     * Утилита для задержки выполнения функции (например, для событий input)
     */
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    const taskTableBody = document.getElementById('task-table-body');
    const taskCountSpan = document.getElementById('task-count');
    const loginButton = document.getElementById('login-button');
    const currentRoleSpan = document.getElementById('current-role');

    // Элементы модального окна
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('password-input');
    const cancelLoginButton = document.getElementById('cancel-login');
    const loginErrorMessage = document.getElementById('login-error-message');
    const submitLoginButton = document.getElementById('submit-login');

    // Элементы модального окна смены пароля
    const changePasswordButton = document.getElementById('change-password-button');
    const changePasswordModal = document.getElementById('change-password-modal');
    const changePasswordForm = document.getElementById('change-password-form');
    const cancelChangePasswordButton = document.getElementById('cancel-change-password');
    const changePasswordErrorMessage = document.getElementById('change-password-error-message');

    // Элементы модального окна добавления задачи
    const addTaskButton = document.getElementById('add-task-button');
    const addTaskModal = document.getElementById('add-task-modal');
    const addTaskForm = document.getElementById('add-task-form');
    const cancelAddTaskButton = document.getElementById('cancel-add-task');
    const addTaskErrorMessage = document.getElementById('add-task-error-message');
    const tagsContainer = document.getElementById('add-task-tags');
    const contestsContainer = document.getElementById('add-task-contests');

    // Элементы модального окна редактирования задачи
    const editTaskModal = document.getElementById('edit-task-modal');
    const editTaskForm = document.getElementById('edit-task-form');
    const cancelEditTaskButton = document.getElementById('cancel-edit-task');
    const editTaskErrorMessage = document.getElementById('edit-task-error-message');

    // Элементы модального окна редактирования контеста
    const editContestModal = document.getElementById('edit-contest-modal');
    const editContestForm = document.getElementById('edit-contest-form');
    const cancelEditContestButton = document.getElementById('cancel-edit-contest');
    const editContestErrorMessage = document.getElementById('edit-contest-error-message');

    // Элементы модального окна редактирования тега
    const editTagModal = document.getElementById('edit-tag-modal');
    const editTagForm = document.getElementById('edit-tag-form');
    const cancelEditTagButton = document.getElementById('cancel-edit-tag');
    const editTagErrorMessage = document.getElementById('edit-tag-error-message');

    // Элементы фильтрации
    const applyFilterButton = document.getElementById('apply-filter-button');
    const difficultyMinInput = document.getElementById('difficulty-min');
    const difficultyMaxInput = document.getElementById('difficulty-max');
    const tagSelectorPlaceholder = document.getElementById('tag-selector-placeholder');

    // Элементы управления видами
    const navButtons = document.querySelectorAll('.nav-button');
    const tasksView = document.querySelector('.content-area'); // Первый content-area - это вид задач
    const contestsView = document.getElementById('contests-management-view');
    const tagsView = document.getElementById('tags-management-view');

    // Элементы управления контестами
    const addContestForm = document.getElementById('add-contest-form');
    const contestsTableBody = document.getElementById('contests-table-body');
    const addContestErrorMessage = document.getElementById('add-contest-error-message');

    // Элементы управления тегами
    const addTagForm = document.getElementById('add-tag-form');
    const tagsTableBody = document.getElementById('tags-table-body');
    const addTagErrorMessage = document.getElementById('add-tag-error-message');

    // Кнопка отчета
    const reportButton = document.getElementById('report-button');

    // --- Автоматическое управление чекбоксом "Подготовлена для Codeforces" ---
    const addTaskLinkInput = document.getElementById('task-link');
    const taskIsCfReadyCheckbox = document.getElementById('task-is-cf-ready');
    addTaskLinkInput.addEventListener('input', (e) => {
        taskIsCfReadyCheckbox.checked = e.target.value.includes('codeforces.com');
    });

    const editTaskLinkInput = document.getElementById('edit-task-link');
    const editTaskIsCfReadyCheckbox = document.getElementById('edit-task-is-cf-ready');
    editTaskLinkInput.addEventListener('input', (e) => {
        editTaskIsCfReadyCheckbox.checked = e.target.value.includes('codeforces.com');
    });

    // --- Логика проверки уникальности ссылки ---
    const addTaskLinkError = document.getElementById('task-link-error');
    const editTaskLinkError = document.getElementById('edit-task-link-error');

    const checkLinkUniqueness = async (link, errorElement, currentTaskId = null) => {
        if (!link) { // Не проверять пустую строку
            errorElement.style.display = 'none';
            return;
        }
        const { isUnique } = await window.db.checkLinkUniqueness(link, currentTaskId);
        if (!isUnique) {
            errorElement.textContent = 'Задача с такой ссылкой уже существует.';
            errorElement.style.display = 'block';
        } else {
            errorElement.style.display = 'none';
        }
    };

    addTaskLinkInput.addEventListener('input', debounce((e) => checkLinkUniqueness(e.target.value, addTaskLinkError), 500));
    editTaskLinkInput.addEventListener('input', debounce((e) => {
        const currentTaskId = parseInt(document.getElementById('edit-task-id').value, 10);
        checkLinkUniqueness(e.target.value, editTaskLinkError, currentTaskId);
    }, 500));

    let isAdmin = false;


    // Функция для отрисовки одной строки таблицы
    function renderTaskRow(task) {
        // Теги и контесты приходят как JSON-строки, парсим их
        const tags = task.Tags ? JSON.parse(task.Tags) : [];
        const contests = task.Contests ? JSON.parse(task.Contests) : [];

        const tagsHtml = tags.map(tag => `<span class="tag">${tag.Title}</span>`).join(' ');
        const contestsHtml = contests.map(c => c.TitleRu).join(', ');

        return `
            <tr>
                <td>${task.TitleRu}</td>
                <td>${task.Difficulty}</td>
                <td><a href="${task.PolygonLink}" target="_blank">Polygon</a></td>
                <td>${contestsHtml || '—'}</td>
                <td class="admin-only">
                    <button class="edit-btn" data-task-id="${task.TaskID}">Edit</button>
                    <button class="delete-btn" data-task-id="${task.TaskID}">Delete</button>
                </td>
            </tr>
        `;
    }

    // Функция для обновления UI в зависимости от статуса администратора
    function updateAdminView(isLoggedIn) {
        isAdmin = isLoggedIn;
        const adminElements = document.querySelectorAll('.admin-only');

        if (isLoggedIn) {
            // Вход выполнен
            currentRoleSpan.textContent = 'Администратор';
            loginButton.textContent = 'Выйти';
            
            adminElements.forEach(el => {
                el.classList.add('is-admin');
                // Включаем сам элемент, если он интерактивный
                if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
                    el.disabled = false;
                }
                // А также все интерактивные элементы внутри него
                el.querySelectorAll('button, input').forEach(child => {
                    child.disabled = false;
                });
            });

        } else {
            // Выход
            currentRoleSpan.textContent = 'Гость';
            loginButton.textContent = 'Войти (Администратор)';

            adminElements.forEach(el => {
                el.classList.remove('is-admin');
                 // Выключаем сам элемент, если он интерактивный
                if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
                    el.disabled = true;
                }
                // А также все интерактивные элементы внутри него
                el.querySelectorAll('button, input').forEach(child => {
                    child.disabled = true;
                });
            });
        }
    }

    // --- Логика модального окна входа ---

    function showLoginModal() {
        passwordInput.value = '';
        loginErrorMessage.style.display = 'none';
        loginModal.style.display = 'flex';

        // Сбрасываем состояние блокировки на случай, если оно было установлено
        passwordInput.disabled = false;
        submitLoginButton.disabled = false;

        passwordInput.focus();
    }

    function hideLoginModal() {
        loginModal.style.display = 'none';
    }

    loginButton.addEventListener('click', async () => {
        if (isAdmin) {
            // Если уже админ, то выходим
            updateAdminView(false);
        } else {
            // Иначе, показываем модальное окно для входа
            showLoginModal();
        }
    });

    cancelLoginButton.addEventListener('click', hideLoginModal);

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Предотвращаем перезагрузку страницы
        const password = passwordInput.value;
        const result = await window.db.login('admin', password);

        if (result.success) {
            hideLoginModal();
            updateAdminView(true);
        } else {
            loginErrorMessage.textContent = `Ошибка: ${result.message}`;
            loginErrorMessage.style.display = 'block';
        }
    });

    // --- Логика модального окна смены пароля ---

    function showChangePasswordModal() {
        changePasswordForm.reset();
        changePasswordErrorMessage.style.display = 'none';

        // Сбрасываем состояние полей и кнопки на случай, если они были заблокированы
        document.getElementById('old-password').disabled = false;
        document.getElementById('new-password').disabled = false;
        document.getElementById('confirm-new-password').disabled = false;
        changePasswordForm.querySelector('button[type="submit"]').disabled = false;

        changePasswordModal.style.display = 'flex';
        document.getElementById('old-password').focus();
    }

    function hideChangePasswordModal() {
        changePasswordModal.style.display = 'none';
    }

    changePasswordButton.addEventListener('click', () => {
        hideLoginModal(); // Сначала прячем окно входа
        showChangePasswordModal();
    });

    cancelChangePasswordButton.addEventListener('click', hideChangePasswordModal);

    changePasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        changePasswordErrorMessage.style.display = 'none';

        const oldPasswordInput = document.getElementById('old-password');
        const newPasswordInput = document.getElementById('new-password');
        const confirmNewPasswordInput = document.getElementById('confirm-new-password');
        const submitButton = changePasswordForm.querySelector('button[type="submit"]');

        const oldPassword = oldPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmNewPassword = confirmNewPasswordInput.value;
        if (newPassword.length < 6) {
            changePasswordErrorMessage.textContent = 'Новый пароль должен содержать не менее 6 символов.';
            changePasswordErrorMessage.style.display = 'block';
            return;
        }
        if (newPassword !== confirmNewPassword) {
            changePasswordErrorMessage.textContent = 'Новые пароли не совпадают.';
            changePasswordErrorMessage.style.display = 'block';
            return;
        }

        // Блокируем кнопку, чтобы избежать повторной отправки
        submitButton.disabled = true;

        const result = await window.db.updateAdminPassword(oldPassword, newPassword);
        if (result.success) {
            // Блокируем поля ввода при успехе
            oldPasswordInput.disabled = true;
            newPasswordInput.disabled = true;
            confirmNewPasswordInput.disabled = true;

            alert('Пароль успешно изменен!');
            hideChangePasswordModal();

            // Показываем снова окно входа, но в заблокированном состоянии,
            // чтобы пользователь был вынужден его закрыть и войти заново.
            passwordInput.value = ''; // Очищаем поле
            passwordInput.disabled = true; // Блокируем поле ввода
            submitLoginButton.disabled = true; // Блокируем кнопку входа
            loginErrorMessage.textContent = 'Пароль изменен. Закройте окно и войдите снова.';
            loginErrorMessage.style.display = 'block';
            loginModal.style.display = 'flex'; // Показываем модальное окно напрямую
        } else {
            changePasswordErrorMessage.textContent = `Ошибка: ${result.message}`;
            changePasswordErrorMessage.style.display = 'block';
            // Разблокируем кнопку в случае ошибки
            submitButton.disabled = false;
        }
    });

    // --- Логика модального окна добавления задачи ---

    async function showAddTaskModal() {
        addTaskForm.reset(); // Сбрасываем форму
        addTaskErrorMessage.style.display = 'none';
        addTaskLinkError.style.display = 'none'; // Скрываем ошибку ссылки

        // Загружаем и отображаем теги
        const tags = await window.db.getAllTags();
        tagsContainer.innerHTML = '<strong>Теги:</strong>' + tags.map(tag => `
            <label>
                <input type="checkbox" name="tags" value="${tag.TagID}"> ${tag.Title}
            </label>
        `).join('');

        // Загружаем и отображаем контесты
        const contests = await window.db.getAllContests();
        contestsContainer.innerHTML = '<strong>Контесты:</strong>' + contests.map(c => `
            <label>
                <input type="checkbox" name="contests" value="${c.ContestID}"> ${c.TitleRu}
            </label>
        `).join('');

        addTaskModal.style.display = 'flex';
    }

    function hideAddTaskModal() {
        addTaskModal.style.display = 'none';
    }

    addTaskButton.addEventListener('click', showAddTaskModal);
    cancelAddTaskButton.addEventListener('click', hideAddTaskModal);

    // --- Логика модального окна редактирования задачи ---

    async function showEditTaskModal(taskId) {
        editTaskErrorMessage.style.display = 'none';
        editTaskLinkError.style.display = 'none'; // Скрываем ошибку ссылки
        // 1. Получаем полные данные задачи
        const task = await window.db.getTaskById(taskId);
        if (!task) {
            alert('Не удалось найти задачу для редактирования.');
            return;
        }

        // 2. Заполняем основные поля формы
        document.getElementById('edit-task-id').value = task.TaskID;
        document.getElementById('edit-task-title').value = task.TitleRu;
        document.getElementById('edit-task-difficulty').value = task.Difficulty;
        document.getElementById('edit-task-link').value = task.PolygonLink;
        document.getElementById('edit-task-condition').value = task.Condition || '';
        document.getElementById('edit-task-idea').value = task.Idea || '';
        document.getElementById('edit-task-note').value = task.Note || '';
        document.getElementById('edit-task-is-cf-ready').checked = !!task.IsCFReady;
        document.getElementById('edit-task-is-yc-ready').checked = !!task.IsYCReady; // SQLite возвращает 1/0, !! преобразует в boolean

        // 3. Загружаем и отмечаем теги
        const tagsContainer = document.getElementById('edit-task-tags');
        const allTags = await window.db.getAllTags();
        tagsContainer.innerHTML = '<strong>Теги:</strong>' + allTags.map(tag => `
            <label>
                <input type="checkbox" name="edit-tags" value="${tag.TagID}" ${task.TagIDs?.includes(tag.TagID) ? 'checked' : ''}> ${tag.Title}
            </label>
        `).join('');

        // 4. Загружаем и отмечаем контесты
        const contestsContainer = document.getElementById('edit-task-contests');
        const allContests = await window.db.getAllContests();
        contestsContainer.innerHTML = '<strong>Контесты:</strong>' + allContests.map(c => `
            <label>
                <input type="checkbox" name="edit-contests" value="${c.ContestID}" ${task.ContestIDs?.includes(c.ContestID) ? 'checked' : ''}> ${c.TitleRu}
            </label>
        `).join('');

        // 5. Показываем модальное окно
        editTaskModal.style.display = 'flex';
    }

    function hideEditTaskModal() {
        editTaskModal.style.display = 'none';
    }

    cancelEditTaskButton.addEventListener('click', hideEditTaskModal);

    // --- Логика модального окна редактирования контеста ---
    function showEditContestModal(id, title, year) {
        editContestForm.reset();
        editContestErrorMessage.style.display = 'none';

        document.getElementById('edit-contest-id').value = id;
        document.getElementById('edit-contest-title').value = title;
        document.getElementById('edit-contest-year').value = year;

        editContestModal.style.display = 'flex';
    }

    function hideEditContestModal() {
        editContestModal.style.display = 'none';
    }

    cancelEditContestButton.addEventListener('click', hideEditContestModal);

    // --- Логика модального окна редактирования тега ---
    function showEditTagModal(id, title) {
        editTagForm.reset();
        editTagErrorMessage.style.display = 'none';

        document.getElementById('edit-tag-id').value = id;
        document.getElementById('edit-tag-title').value = title;

        editTagModal.style.display = 'flex';
    }

    function hideEditTagModal() {
        editTagModal.style.display = 'none';
    }

    cancelEditTagButton.addEventListener('click', hideEditTagModal);


    // --- Обработка кликов по кнопкам в таблице (делегирование событий) ---
    taskTableBody.addEventListener('click', async (event) => {
        const target = event.target;

        if (target.classList.contains('delete-btn')) {
            const taskId = parseInt(target.dataset.taskId, 10);
            const taskTitle = target.closest('tr').querySelector('td').textContent;
            const confirmed = await window.db.showConfirmDialog(`Вы уверены, что хотите удалить задачу "${taskTitle}"?`);
            if (confirmed) {
                await window.db.deleteTask(taskId);
                loadAndDisplayTasks(); // Обновляем список
            }
        }

        if (target.classList.contains('edit-btn')) {
            const taskId = parseInt(target.dataset.taskId, 10);
            showEditTaskModal(taskId);
        }
    });

    // --- Общая логика для форм добавления/редактирования задачи ---

    async function handleTaskFormSubmit(event, { isEditing = false } = {}) {
        event.preventDefault();

        const idPrefix = isEditing ? 'edit-' : '';
        const tagInputName = isEditing ? 'edit-tags' : 'tags';
        const contestInputName = isEditing ? 'edit-contests' : 'contests';

        const errorMessageElement = document.getElementById(`${idPrefix}task-error-message`);
        const linkErrorElement = document.getElementById(`${idPrefix}task-link-error`);

        // Превентивная проверка, если пользователь проигнорировал предупреждение
        if (linkErrorElement.style.display === 'block') {
            return; // Не отправляем форму, если есть ошибка уникальности
        }

        // Собираем данные из формы
        const title = document.getElementById(`${idPrefix}task-title`).value;
        const difficulty = document.getElementById(`${idPrefix}task-difficulty`).value;
        const link = document.getElementById(`${idPrefix}task-link`).value;
        const condition = document.getElementById(`${idPrefix}task-condition`).value;
        const idea = document.getElementById(`${idPrefix}task-idea`).value;
        const note = document.getElementById(`${idPrefix}task-note`).value;
        const isYCReady = document.getElementById(`${idPrefix}task-is-yc-ready`).checked;

        const selectedTags = Array.from(document.querySelectorAll(`input[name="${tagInputName}"]:checked`))
            .map(cb => parseInt(cb.value));
        
        const selectedContests = Array.from(document.querySelectorAll(`input[name="${contestInputName}"]:checked`))
            .map(cb => parseInt(cb.value));
        
        const taskData = { title, difficulty, link, condition, idea, note, isYCReady, tags: selectedTags, contests: selectedContests };
        
        let result;
        if (isEditing) {
            const taskId = parseInt(document.getElementById('edit-task-id').value, 10);
            if (isNaN(taskId)) return;
            result = await window.db.updateTask(taskId, taskData);
        } else {
            result = await window.db.addTask(taskData);
        }

        const modal = isEditing ? editTaskModal : addTaskModal;

        if (result.success) {
            modal.style.display = 'none';
            await loadAndDisplayTasks(); // Перезагружаем список задач
        } else {
            // Если бекенд вернул ошибку уникальности (как fallback), покажем ее у поля
            if (result.message.includes('ссылкой на Polygon уже существует')) {
                linkErrorElement.textContent = result.message;
                linkErrorElement.style.display = 'block';
            } else {
                // Иначе показываем общую ошибку внизу
                errorMessageElement.textContent = `Ошибка: ${result.message}`;
                errorMessageElement.style.display = 'block';
            }

            console.error(
                `Ошибка при ${isEditing ? 'обновлении' : 'добавлении'} задачи.`, 
                'Отправлялись данные:', taskData, 
                'Получен ответ:', result
            );
        }
    }

    // Назначаем общий обработчик на обе формы
    addTaskForm.addEventListener('submit', (e) => handleTaskFormSubmit(e, { isEditing: false }));
    editTaskForm.addEventListener('submit', (e) => handleTaskFormSubmit(e, { isEditing: true }));


    // --- Логика управления справочниками ---

    async function refreshAllDynamicData() {
        // Обновляем вид, который сейчас активен
        if (tagsView.style.display !== 'none') {
            await loadTagsView();
        }
        if (contestsView.style.display !== 'none') {
            await loadContestsView();
        }
        // Всегда обновляем фильтры в сайдбаре, т.к. теги могли измениться
        await populateTagFilters();
    }

    // Загрузка и отображение тегов
    async function loadTagsView() {
        const tags = await window.db.getAllTags();
        tagsTableBody.innerHTML = tags.map(tag => `
            <tr>
                <td>${tag.Title}</td>
                <td>
                    <button class="edit-tag-btn" data-id="${tag.TagID}" data-title="${tag.Title}">Редактировать</button>
                    <button class="delete-tag-btn" data-id="${tag.TagID}" data-title="${tag.Title}">Удалить</button>
                </td>
            </tr>
        `).join('');
    }

    // Загрузка и отображение контестов
    async function loadContestsView() {
        const contests = await window.db.getAllContests();
        contestsTableBody.innerHTML = contests.map(c => `
            <tr>
                <td>${c.TitleRu}</td>
                <td>${c.Year}</td>
                <td>
                    <button class="edit-contest-btn" data-id="${c.ContestID}" data-title="${c.TitleRu}" data-year="${c.Year}">Редактировать</button>
                    <button class="delete-contest-btn" data-id="${c.ContestID}" data-title="${c.TitleRu}">Удалить</button>
                </td>
            </tr>
        `).join('');
    }

    // Добавление нового тега
    addTagForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        addTagErrorMessage.style.display = 'none';
        const titleInput = document.getElementById('new-tag-title');
        const title = titleInput.value.trim();
        if (title) {
            const result = await window.db.addTag(title);
            if (result.success) {
                titleInput.value = '';
                await refreshAllDynamicData();
            } else {
                addTagErrorMessage.textContent = `Ошибка: ${result.message}`;
                addTagErrorMessage.style.display = 'block';
            }
        }
    });

    // Добавление нового контеста
    addContestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        addContestErrorMessage.style.display = 'none';
        const titleInput = document.getElementById('new-contest-title');
        const yearInput = document.getElementById('new-contest-year');
        const title = titleInput.value.trim();
        const year = parseInt(yearInput.value.trim(), 10);

        if (title && !isNaN(year)) {
            const result = await window.db.addContest(title, year);
            if (result.success) {
                titleInput.value = '';
                yearInput.value = '';
                await loadContestsView(); // Обновляем список контестов
                await loadAndDisplayTasks(); // Обновляем и список задач
            } else {
                addContestErrorMessage.textContent = `Ошибка: ${result.message}`;
                addContestErrorMessage.style.display = 'block';
            }
        }
    });

    // Обработка формы редактирования тега
    editTagForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        editTagErrorMessage.style.display = 'none';

        const id = parseInt(document.getElementById('edit-tag-id').value, 10);
        const newTitle = document.getElementById('edit-tag-title').value.trim();

        if (newTitle) {
            const result = await window.db.updateTag(id, newTitle);
            if (result.success) {
                hideEditTagModal();
                await refreshAllDynamicData();
            } else {
                editTagErrorMessage.textContent = `Ошибка: ${result.message}`;
                editTagErrorMessage.style.display = 'block';
            }
        }
    });

    // Обработка событий для таблицы тегов
    tagsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = parseInt(target.dataset.id, 10);
        const title = target.dataset.title;
        if (target.classList.contains('delete-tag-btn')) {
            const confirmed = await window.db.showConfirmDialog(`Удалить тег "${title}"? Это действие также уберет его из всех задач.`);
            if (confirmed) {
                await window.db.deleteTag(id);
                await refreshAllDynamicData();
            }
        }

        if (target.classList.contains('edit-tag-btn')) {
            showEditTagModal(id, title);
        }
    });

    // Обработка формы редактирования контеста
    editContestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        editContestErrorMessage.style.display = 'none';

        const id = parseInt(document.getElementById('edit-contest-id').value, 10);
        const newTitle = document.getElementById('edit-contest-title').value.trim();
        const newYear = document.getElementById('edit-contest-year').value.trim();
        const newYearNum = parseInt(newYear, 10);

        if (newTitle && !isNaN(newYearNum)) {
            const result = await window.db.updateContest(id, newTitle, newYearNum);
            if (result.success) {
                hideEditContestModal();
                await loadContestsView();
                await loadAndDisplayTasks();
            } else {
                editContestErrorMessage.textContent = `Ошибка: ${result.message}`;
                editContestErrorMessage.style.display = 'block';
            }
        }
    });

    // Обработка событий для таблицы контестов
    contestsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = parseInt(target.dataset.id, 10);
        const title = target.dataset.title;
        const year = target.dataset.year;
        if (target.classList.contains('delete-contest-btn')) {
            const confirmed = await window.db.showConfirmDialog(`Удалить контест "${title}"? Это действие также уберет его из всех задач.`);
            if (confirmed) {
                await window.db.deleteContest(id);
                await loadContestsView(); // Обновляем список контестов
                await loadAndDisplayTasks(); // Обновляем и список задач
            }
        }

        if (target.classList.contains('edit-contest-btn')) {
            showEditContestModal(id, title, year);
        }
    });


    // --- Глобальный обработчик для клавиши Escape ---
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (loginModal.style.display !== 'none') {
                hideLoginModal();
            }
            if (addTaskModal.style.display !== 'none') {
                hideAddTaskModal();
            }
            if (editTaskModal.style.display !== 'none') {
                hideEditTaskModal();
            }
            if (editContestModal.style.display !== 'none') {
                hideEditContestModal();
            }
            if (editTagModal.style.display !== 'none') {
                hideEditTagModal();
            }
            if (changePasswordModal.style.display !== 'none') {
                hideChangePasswordModal();
            }
        }
    });

    // --- Логика переключения видов ---
    function switchView(targetView) {
        document.querySelectorAll('.content-area').forEach(view => {
            view.style.display = 'none';
        });
        targetView.style.display = 'block';
    }

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            navButtons.forEach(btn => btn.classList.remove('active-nav'));
            button.classList.add('active-nav');
            
            // Используем data-атрибут для большей надежности
            const viewId = button.dataset.view;
            switch (viewId) {
                case 'tasks':
                    switchView(tasksView);
                    break;
                case 'contests':
                    switchView(contestsView);
                    loadContestsView();
                    break;
                case 'tags':
                    switchView(tagsView);
                    loadTagsView();
                    break;
            }
        });
    });

    // --- Логика фильтрации ---

    async function populateTagFilters() {
        const tags = await window.db.getAllTags();
        if (tags && tags.length > 0) {
            const tagsHtml = tags.map(tag => `
                <label class="checkbox-label">
                    <input type="checkbox" class="filter-tag-checkbox" value="${tag.TagID}"> ${tag.Title}
                </label>
            `).join('');
            tagSelectorPlaceholder.innerHTML = tagsHtml;
        } else {
            tagSelectorPlaceholder.innerHTML = '<p>Теги не найдены.</p>';
        }
    }

    applyFilterButton.addEventListener('click', () => {
        const minDifficulty = parseInt(difficultyMinInput.value, 10);
        const maxDifficulty = parseInt(difficultyMaxInput.value, 10);
        const selectedTags = Array.from(document.querySelectorAll('.filter-tag-checkbox:checked'))
            .map(cb => parseInt(cb.value, 10));

        const filters = {
            minDifficulty: !isNaN(minDifficulty) ? minDifficulty : null,
            maxDifficulty: !isNaN(maxDifficulty) ? maxDifficulty : null,
            tags: selectedTags
        };

        loadAndDisplayTasks(filters);
    });

    // --- Логика формирования отчета ---
    reportButton.addEventListener('click', async () => {
        // 1. Получаем текущие фильтры из полей ввода
        const minDifficulty = parseInt(difficultyMinInput.value, 10);
        const maxDifficulty = parseInt(difficultyMaxInput.value, 10);
        const selectedTags = Array.from(document.querySelectorAll('.filter-tag-checkbox:checked'))
            .map(cb => parseInt(cb.value, 10));

        const filters = {
            minDifficulty: !isNaN(minDifficulty) ? minDifficulty : null,
            maxDifficulty: !isNaN(maxDifficulty) ? maxDifficulty : null,
            tags: selectedTags
        };

        // 2. Получаем отфильтрованные данные
        const tasks = await window.db.getAllTasks(filters);
        
        if (tasks.length === 0) {
            alert('Нет данных для формирования отчета. Измените фильтры или добавьте задачи.');
            return;
        }

        // 3. Формируем CSV контент
        const headers = ['ID', 'Название', 'Сложность', 'Ссылка на Polygon', 'Готова для CF', 'Готова для YC', 'Условие', 'Идея', 'Примечание', 'Контесты', 'Теги'];
        
        const rows = tasks.map(task => {
            // Данные приходят как JSON-строки, их нужно парсить
            const taskTags = task.Tags ? JSON.parse(task.Tags) : [];
            const taskContests = task.Contests ? JSON.parse(task.Contests) : [];

            // Для CSV поля с точкой с запятой, кавычками или переносами строк нужно оборачивать в кавычки и экранировать внутренние кавычки
            const escapeCsvField = (field) => {
                const str = String(field || ''); // Убедимся, что работаем со строкой и обрабатываем null/undefined
                if (str.includes(';') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const id = task.TaskID;
            const title = escapeCsvField(task.TitleRu);
            const difficulty = task.Difficulty || '';
            const link = task.PolygonLink || '';
            const isCfReady = task.IsCFReady ? 'Да' : 'Нет';
            const isYcReady = task.IsYCReady ? 'Да' : 'Нет';
            const condition = escapeCsvField(task.Condition);
            const idea = escapeCsvField(task.Idea);
            const note = escapeCsvField(task.Note);
            const contestsStr = escapeCsvField(taskContests.map(c => c.TitleRu).join('; ')); // Используем ; как разделитель внутри поля
            const tagsStr = escapeCsvField(taskTags.map(t => t.Title).join('; '));

            return [id, title, difficulty, link, isCfReady, isYcReady, condition, idea, note, contestsStr, tagsStr].join(';');
        });

        const csvContent = [headers.join(';'), ...rows].join('\n');

        // 4. Вызываем метод main процесса для сохранения файла
        const result = await window.db.saveReport(csvContent);
        if (result.success) alert(`Отчет успешно сохранен в: ${result.path}`);
        else if (result.message !== 'Сохранение отменено.') alert(`Ошибка сохранения отчета: ${result.message}`);
    });


    // Асинхронная функция для загрузки и отображения всех задач
    async function loadAndDisplayTasks(filters = {}) {
        const tasks = await window.db.getAllTasks(filters); // Вызываем функцию из preload.js
        taskCountSpan.textContent = tasks.length;
        taskTableBody.innerHTML = tasks.length > 0 ? tasks.map(renderTaskRow).join('') : '<tr><td colspan="5">Задачи не найдены.</td></tr>';
        // После отрисовки таблицы, нужно снова применить видимость админ. элементов
        updateAdminView(isAdmin);
    }

    // --- Инициализация при загрузке страницы ---
    async function initializeApp() {
        await populateTagFilters();
        await loadAndDisplayTasks();
    }

    initializeApp();
});