// App State
let todos = [];
let selectedTodo = null;
let currentFilter = 'all';
let completedPomodoros = 0;
let totalFocusTime = 0; // in minutes

// Timer State
let isTimerActive = false;
let timeLeft = 25 * 60; // 25 minutes in seconds
let isBreakMode = false;
let timerInterval = null;
const WORK_TIME = 25 * 60;
const SHORT_BREAK = 5 * 60;
const LONG_BREAK = 15 * 60;

// DOM Elements
const elements = {
    // Timer elements
    timeDisplay: document.getElementById('time-display'),
    startPauseBtn: document.getElementById('start-pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    timerMode: document.getElementById('timer-mode'),
    progressCircle: document.getElementById('progress-circle'),
    completedPomodorosDisplay: document.getElementById('completed-pomodoros'),
    selectedTaskName: document.getElementById('selected-task-name'),
    
    // Todo elements
    newTodoInput: document.getElementById('new-todo-input'),
    addTodoForm: document.getElementById('add-todo-form'),
    todoList: document.getElementById('todo-list'),
    emptyState: document.getElementById('empty-state'),
    totalTasks: document.getElementById('total-tasks'),
    completedTasks: document.getElementById('completed-tasks'),
    
    // Stats elements
    focusTime: document.getElementById('focus-time'),
    tasksCompleted: document.getElementById('tasks-completed'),
    productivityScore: document.getElementById('productivity-score'),
    
    // Filter buttons
    filterBtns: document.querySelectorAll('.filter-btn')
};

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadFromStorage();
    updateDisplay();
});

function initializeApp() {
    updateTimerDisplay();
    updateProgressRing();
    updateStats();
}

function setupEventListeners() {
    // Timer controls
    elements.startPauseBtn.addEventListener('click', toggleTimer);
    elements.resetBtn.addEventListener('click', resetTimer);
    
    // Todo form
    elements.addTodoForm.addEventListener('submit', addTodo);
    
    // Filter buttons
    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            setFilter(e.target.dataset.filter);
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Timer Functions
function toggleTimer() {
    if (isTimerActive) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    if (!selectedTodo && !isBreakMode) {
        showNotification('Please select a task to work on first!', 'warning');
        return;
    }
    
    isTimerActive = true;
    elements.startPauseBtn.innerHTML = '<span class="btn-icon">⏸</span>Pause';
    document.body.classList.add('timer-active');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        updateProgressRing();
        
        if (timeLeft <= 0) {
            timerFinished();
        }
    }, 1000);
}

function pauseTimer() {
    isTimerActive = false;
    clearInterval(timerInterval);
    elements.startPauseBtn.innerHTML = '<span class="btn-icon">▶</span>Start';
    document.body.classList.remove('timer-active');
}

function resetTimer() {
    pauseTimer();
    timeLeft = isBreakMode ? (completedPomodoros % 4 === 0 ? LONG_BREAK : SHORT_BREAK) : WORK_TIME;
    updateTimerDisplay();
    updateProgressRing();
}

function timerFinished() {
    pauseTimer();
    playNotificationSound();
    
    if (isBreakMode) {
        // Break finished - switch to work mode
        isBreakMode = false;
        timeLeft = WORK_TIME;
        elements.timerMode.textContent = 'Focus Time';
        document.body.classList.remove('break-mode');
        showNotification('Break over! Ready to focus?', 'success');
    } else {
        // Work session finished
        completedPomodoros++;
        totalFocusTime += 25;
        
        // Add pomodoro to selected task
        if (selectedTodo) {
            const todoIndex = todos.findIndex(t => t.id === selectedTodo.id);
            if (todoIndex !== -1) {
                todos[todoIndex].pomodoros++;
                saveToStorage();
            }
        }
        
        // Switch to break mode
        isBreakMode = true;
        const isLongBreak = completedPomodoros % 4 === 0;
        timeLeft = isLongBreak ? LONG_BREAK : SHORT_BREAK;
        elements.timerMode.textContent = isLongBreak ? 'Long Break' : 'Short Break';
        document.body.classList.add('break-mode');
        
        showNotification(`Great work! Time for a ${isLongBreak ? 'long' : 'short'} break.`, 'success');
    }
    
    updateDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    elements.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateProgressRing() {
    const totalTime = isBreakMode ? 
        (completedPomodoros % 4 === 0 ? LONG_BREAK : SHORT_BREAK) : 
        WORK_TIME;
    const progress = (totalTime - timeLeft) / totalTime;
    const circumference = 2 * Math.PI * 54; // radius is 54
    const strokeDashoffset = circumference - (progress * circumference);
    elements.progressCircle.style.strokeDashoffset = strokeDashoffset;
}

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 1);
    } catch (error) {
        console.log('Audio notification not supported');
    }
}

// Todo Functions
function addTodo(e) {
    e.preventDefault();
    const text = elements.newTodoInput.value.trim();
    
    if (!text) return;
    
    const todo = {
        id: Date.now(),
        text: text,
        completed: false,
        pomodoros: 0,
        createdAt: new Date()
    };
    
    todos.unshift(todo);
    elements.newTodoInput.value = '';
    saveToStorage();
    updateDisplay();
    
    showNotification('Task added successfully!', 'success');
}

function toggleTodo(id) {
    const todoIndex = todos.findIndex(t => t.id === id);
    if (todoIndex !== -1) {
        todos[todoIndex].completed = !todos[todoIndex].completed;
        
        // If we're completing the currently selected task, unselect it
        if (todos[todoIndex].completed && selectedTodo && selectedTodo.id === id) {
            selectedTodo = null;
            elements.selectedTaskName.textContent = 'Select a task to start';
        }
        
        saveToStorage();
        updateDisplay();
        
        if (todos[todoIndex].completed) {
            showNotification('Task completed! 🎉', 'success');
        }
    }
}

function deleteTodo(id) {
    if (selectedTodo && selectedTodo.id === id) {
        selectedTodo = null;
        elements.selectedTaskName.textContent = 'Select a task to start';
    }
    
    todos = todos.filter(t => t.id !== id);
    saveToStorage();
    updateDisplay();
    showNotification('Task deleted', 'info');
}

function selectTodo(id) {
    if (isTimerActive) {
        showNotification('Stop the timer before selecting a different task!', 'warning');
        return;
    }
    
    const todo = todos.find(t => t.id === id && !t.completed);
    if (todo) {
        selectedTodo = todo;
        elements.selectedTaskName.textContent = todo.text;
        updateDisplay();
        showNotification(`Selected: ${todo.text}`, 'info');
    }
}

function setFilter(filter) {
    currentFilter = filter;
    
    // Update active filter button
    elements.filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    updateDisplay();
}

function getFilteredTodos() {
    switch (currentFilter) {
        case 'active':
            return todos.filter(t => !t.completed);
        case 'completed':
            return todos.filter(t => t.completed);
        default:
            return todos;
    }
}

// Display Functions
function updateDisplay() {
    renderTodos();
    updateStats();
    updateTaskCounter();
    elements.completedPomodorosDisplay.textContent = completedPomodoros;
}

function renderTodos() {
    const filteredTodos = getFilteredTodos();
    
    if (filteredTodos.length === 0) {
        elements.todoList.style.display = 'none';
        elements.emptyState.style.display = 'block';
        return;
    }
    
    elements.todoList.style.display = 'block';
    elements.emptyState.style.display = 'none';
    
    elements.todoList.innerHTML = filteredTodos.map(todo => `
        <li class="todo-item ${todo.completed ? 'completed' : ''} ${selectedTodo && selectedTodo.id === todo.id ? 'selected' : ''}" 
            onclick="selectTodo(${todo.id})">
            <input type="checkbox" 
                   class="todo-checkbox" 
                   ${todo.completed ? 'checked' : ''} 
                   onchange="toggleTodo(${todo.id})"
                   onclick="event.stopPropagation()">
            <div class="todo-content">
                <span class="todo-text">${escapeHtml(todo.text)}</span>
                <div class="todo-meta">
                    ${todo.pomodoros > 0 ? `<span class="pomodoro-count-badge">🍅 ${todo.pomodoros}</span>` : ''}
                    <div class="todo-actions">
                        <button class="btn btn-small btn-danger" 
                                onclick="event.stopPropagation(); deleteTodo(${todo.id})"
                                title="Delete task">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        </li>
    `).join('');
}

function updateTaskCounter() {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    
    elements.totalTasks.textContent = total;
    elements.completedTasks.textContent = completed;
}

function updateStats() {
    // Focus time
    const hours = Math.floor(totalFocusTime / 60);
    const minutes = totalFocusTime % 60;
    elements.focusTime.textContent = `${hours}h ${minutes}m`;
    
    // Tasks completed
    const completedTasksCount = todos.filter(t => t.completed).length;
    elements.tasksCompleted.textContent = completedTasksCount;
    
    // Productivity score (based on completed tasks and focus time)
    const totalTasks = todos.length;
    let productivityScore = 0;
    
    if (totalTasks > 0) {
        const taskCompletionRate = (completedTasksCount / totalTasks) * 100;
        const focusBonus = Math.min(totalFocusTime * 2, 50); // Max 50% bonus from focus time
        productivityScore = Math.round(taskCompletionRate + focusBonus);
        productivityScore = Math.min(productivityScore, 100);
    }
    
    elements.productivityScore.textContent = `${productivityScore}%`;
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

function handleKeyboardShortcuts(e) {
    // Space bar to start/pause timer
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        toggleTimer();
    }
    
    // Escape to reset timer
    if (e.code === 'Escape') {
        resetTimer();
    }
    
    // Enter in input field adds todo (handled by form submission)
    
    // Numbers 1-3 for filters
    if (e.code === 'Digit1') {
        setFilter('all');
    } else if (e.code === 'Digit2') {
        setFilter('active');
    } else if (e.code === 'Digit3') {
        setFilter('completed');
    }
}

// Storage Functions
function saveToStorage() {
    const data = {
        todos: todos,
        selectedTodo: selectedTodo,
        completedPomodoros: completedPomodoros,
        totalFocusTime: totalFocusTime,
        currentFilter: currentFilter
    };
    
    try {
        // Using a simple object to store data in memory since localStorage is not available
        window.appData = data;
    } catch (error) {
        console.log('Storage not available');
    }
}

function loadFromStorage() {
    try {
        // Load from memory storage
        if (window.appData) {
            const data = window.appData;
            todos = data.todos || [];
            selectedTodo = data.selectedTodo || null;
            completedPomodoros = data.completedPomodoros || 0;
            totalFocusTime = data.totalFocusTime || 0;
            currentFilter = data.currentFilter || 'all';
            
            // Update selected task display
            if (selectedTodo) {
                elements.selectedTaskName.textContent = selectedTodo.text;
            }
            
            // Update filter buttons
            setFilter(currentFilter);
        }
    } catch (error) {
        console.log('Could not load from storage');
    }
}

// Auto-save every 30 seconds
setInterval(saveToStorage, 30000);

// Save before page unload
window.addEventListener('beforeunload', saveToStorage);

// Initialize sample data for demo
function initializeSampleData() {
    if (todos.length === 0) {
        todos = [
            {
                id: 1,
                text: "Complete project proposal",
                completed: false,
                pomodoros: 2,
                createdAt: new Date()
            },
            {
                id: 2,
                text: "Review design mockups",
                completed: false,
                pomodoros: 1,
                createdAt: new Date()
            },
            {
                id: 3,
                text: "Send follow-up emails",
                completed: true,
                pomodoros: 1,
                createdAt: new Date()
            }
        ];
        saveToStorage();
    }
}

// Call initialize sample data on first load
setTimeout(() => {
    if (todos.length === 0) {
        initializeSampleData();
        updateDisplay();
    }
}, 1000);