/**
 * 番茄钟计时器类
 * 提供番茄工作法计时功能，包括工作时段、休息时段管理，以及任务统计等功能
 */
class PomodoroTimer {
    /**
     * 构造函数，初始化番茄钟计时器
     */
    constructor() {
		// API配置
        this.API_BASE = 'http://localhost:3000/api';  // API基础地址
        this.API_ENDPOINTS = {
            SESSIONS: `${this.API_BASE}/sessions`,  // 番茄钟API
            STATS: `${this.API_BASE}/stats`, // 统计API
            CHAT: `${this.API_BASE}/chat`, // AI聊天API
            TODOS: `${this.API_BASE}/todos` // 待办事项API
        };

        // 引用全局认证服务
        this.authService = authService;
        
		// 初始化进度环 - 添加延迟确保DOM加载完成
		setTimeout(() => {
			this.setProgressRing();
			this.updateDisplay();
		}, 100);
		
        // 计时器状态
        this.isRunning = false;  // 是否正在运行
        this.isWorkSession = true;  // 是否为工作时段
        this.timeLeft = 25 * 60;  // 剩余时间（秒）
        this.intervalId = null;  // 计时器ID
        
        // 番茄钟设置
        this.workDuration = 25 * 60;  // 工作时长（秒）
        this.breakDuration = 5 * 60;  // 短休息时长（秒）
        this.longBreakDuration = 15 * 60;  // 长休息时长（秒）
        this.sessionsCompleted = 0;  // 已完成的番茄钟数量
        
        // WebSocket连接
        this.socket = null;  // WebSocket实例
        this.currentRoom = null;  // 当前房间ID
        this.username = null;  // 用户名
        
        // 图表实例
        this.charts = {};  // 存储图表实例
        
        // DOM元素
        this.elements = {
            // 导航元素
            navBtns: document.querySelectorAll('.nav-btn'),  // 导航按钮
            pages: document.querySelectorAll('.page'),  // 页面元素
            
            // 番茄钟元素
            timeDisplay: document.getElementById('time-display'),  // 时间显示
            sessionType: document.getElementById('session-type'),  // 时段类型显示
            startBtn: document.getElementById('start-btn'),  // 开始按钮
            pauseBtn: document.getElementById('pause-btn'),  // 暂停按钮
            resetBtn: document.getElementById('reset-btn'),  // 重置按钮
            skipBtn: document.getElementById('skip-btn'),  // 跳过按钮
            taskInput: document.getElementById('task-input'),  // 任务输入
            taskLength: document.getElementById('task-length'),  // 任务长度显示
            notificationSound: document.getElementById('notification-sound'),  // 通知声音
            progressCircle: document.querySelector('.progress-ring-circle'),  // 进度圆环
            
            // AI聊天元素
            aiChatMessages: document.getElementById('ai-chat-messages'),  // AI聊天消息
            aiMessageInput: document.getElementById('ai-message-input'),  // AI消息输入
            aiSendBtn: document.getElementById('ai-send-btn'),  // AI发送按钮
            quickActionBtns: document.querySelectorAll('.quick-action-btn'),  // 快捷操作按钮
            
            // 自习室元素
            usernameInput: document.getElementById('username-input'),  // 用户名输入
            roomIdInput: document.getElementById('room-id-input'),  // 房间ID输入
            joinRoomBtn: document.getElementById('join-room-btn'),  // 加入房间按钮
            createRoomBtn: document.getElementById('create-room-btn'),  // 创建房间按钮
            roomContent: document.getElementById('room-content'),  // 房间内容
            roomUsersList: document.getElementById('room-users-list'),  // 房间用户列表
            roomChatMessages: document.getElementById('room-chat-messages'),  // 房间聊天消息
            roomMessageInput: document.getElementById('room-message-input'),  // 房间消息输入
            roomSendBtn: document.getElementById('room-send-btn'),
            
            // 待办事项元素
            newTodoInput: document.getElementById('new-todo-input'),
            todoDuration: document.getElementById('todo-duration'),
            addTodoBtn: document.getElementById('add-todo-btn'),
            pendingTodos: document.getElementById('pending-todos'),
            completedTodos: document.getElementById('completed-todos'),
            
            // 统计元素
            statsPeriod: document.getElementById('stats-period'),
            totalSessions: document.getElementById('total-sessions'),
            totalMinutes: document.getElementById('total-minutes'),
            todaySessions: document.getElementById('today-sessions'),
            todayMinutes: document.getElementById('today-minutes'),
            historyList: document.getElementById('history-list'),
            durationChart: document.getElementById('duration-chart'),
            monthlyChart: document.getElementById('monthly-chart'),
            hourlyChart: document.getElementById('hourly-chart'),
            yearlyChart: document.getElementById('yearly-chart'),
            
            // 新增的统计徽章元素
            todaySessionsCount: document.getElementById('today-sessions-count'),
            totalSessionsCount: document.getElementById('total-sessions-count'),
			
            chartAnalysisBtn: document.getElementById('chart-analysis-btn'),
			chartsPage: document.getElementById('charts-page'),
		    backToStatsBtn: document.getElementById('back-to-stats'),
		    chartPeriod: document.getElementById('chart-period'),
		    avgSessions: document.getElementById('avg-sessions'),
			avgMinutes: document.getElementById('avg-minutes'),
		    recordCount: document.getElementById('record-count'),
		    longestSession: document.getElementById('longest-session'),
		    bestHour: document.getElementById('best-hour'),
		    streakDays: document.getElementById('streak-days'),
		    completionRate: document.getElementById('completion-rate'),

            // 个人中心元素
            userUsername: document.getElementById('user-username'),
            userEmail: document.getElementById('user-email'),
            userCreatedAt: document.getElementById('user-created-at'),
            changePasswordForm: document.getElementById('change-password-form'),
            oldPassword: document.getElementById('old-password'),
            newPassword: document.getElementById('new-password'),
            confirmNewPassword: document.getElementById('confirm-new-password'),
            changePasswordBtn: document.getElementById('change-password-btn'),
            logoutBtn: document.getElementById('logout-btn'),
            deleteAccountBtn: document.getElementById('delete-account-btn'),
            deleteAccountModal: document.getElementById('delete-account-modal'),
            logoutModal: document.getElementById('logout-modal'),
            deleteConfirmPassword: document.getElementById('delete-confirm-password'),
            cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
            confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
            cancelLogoutBtn: document.getElementById('cancel-logout-btn'),
            confirmLogoutBtn: document.getElementById('confirm-logout-btn')
        }; 
        
        // 初始化
        this.setProgressRing();
        this.bindEvents();
        this.loadHistory();
        this.loadStats();
        this.loadTodos();
        this.initWebSocket();
        this.updateDisplay();
    }
    
    // 设置进度环
    setProgressRing() {
        const circle = this.elements.progressCircle;
        if (!circle) {
            console.error('进度环元素未找到');
            return;
        }
        
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference;
        
        this.progressCircumference = circumference;
        console.log('进度环初始化完成', { radius, circumference });
    }
    
    // 更新进度环
    updateProgressRing() {
        const circle = this.elements.progressCircle;
        if (!circle || !this.progressCircumference) {
            console.error('进度环未正确初始化');
            return;
        }
        
        const totalTime = this.isWorkSession ? this.workDuration : this.breakDuration;
        const progress = 1 - (this.timeLeft / totalTime);
        const offset = this.progressCircumference - progress * this.progressCircumference;
        
        circle.style.strokeDashoffset = offset;
        
        // 设置颜色
        let color;
        if (this.isWorkSession) {
            color = '#ff6b6b'; // 工作时段：红色
        } else {
            // 判断是长休息还是短休息
            const isLongBreak = this.sessionsCompleted > 0 && this.sessionsCompleted % 4 === 0;
            color = isLongBreak ? '#667eea' : '#4ecdc4'; // 长休息：蓝色，短休息：青色
        }
        
        circle.style.stroke = color;
        
        // 更新父容器的类名用于CSS样式
        const timerContainer = document.querySelector('.timer-circle');
        if (timerContainer) {
            timerContainer.className = 'timer-circle';
            if (this.isWorkSession) {
                timerContainer.classList.add('work-session');
            } else {
                const isLongBreak = this.sessionsCompleted > 0 && this.sessionsCompleted % 4 === 0;
                timerContainer.classList.add(isLongBreak ? 'long-break-session' : 'break-session');
            }
        }
    }
    
    // 绑定事件
    bindEvents() {
        // 导航事件
        this.elements.navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchPage(e.target.getAttribute('data-page'));
            });
        });
        
        // 番茄钟控制事件
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.pauseBtn.addEventListener('click', () => this.pause());
        this.elements.resetBtn.addEventListener('click', () => this.reset());
        this.elements.skipBtn.addEventListener('click', () => this.skip());
        
		// 任务输入监听
        this.elements.taskInput.addEventListener('input', (e) => {
            const length = e.target.value.length;
            this.elements.taskLength.textContent = `${length}/50`;
        });
        
        // 初始化时也设置一次
        this.elements.taskLength.textContent = `0/50`;
        
        // AI聊天事件
        this.elements.aiSendBtn.addEventListener('click', () => this.sendAIMessage());
        this.elements.aiMessageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendAIMessage();
        });
        
        this.elements.quickActionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const prompt = e.currentTarget.getAttribute('data-prompt');
                this.sendQuickMessage(prompt);
            });
        });
        
        // 自习室事件
        this.elements.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.elements.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.elements.roomSendBtn.addEventListener('click', () => this.sendRoomMessage());
        this.elements.roomMessageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendRoomMessage();
        });
        
        // 待办事项事件
        this.elements.addTodoBtn.addEventListener('click', () => this.addTodo());
        this.elements.newTodoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });
        
        // 统计事件
        this.elements.statsPeriod.addEventListener('change', () => this.loadStats());

		this.elements.chartAnalysisBtn.addEventListener('click', () => this.showChartAnalysis());
		this.elements.backToStatsBtn.addEventListener('click', () => this.switchPage('stats'));

        // 个人中心事件
        if (this.elements.changePasswordForm) {
            this.elements.changePasswordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleChangePassword();
            });
        }

        if (this.elements.logoutBtn) {
            this.elements.logoutBtn.addEventListener('click', () => this.showLogoutModal());
        }

        if (this.elements.deleteAccountBtn) {
            this.elements.deleteAccountBtn.addEventListener('click', () => this.showDeleteAccountModal());
        }

        // 模态框事件
        if (this.elements.cancelLogoutBtn) {
            this.elements.cancelLogoutBtn.addEventListener('click', () => this.hideLogoutModal());
        }

        if (this.elements.confirmLogoutBtn) {
            this.elements.confirmLogoutBtn.addEventListener('click', () => this.confirmLogout());
        }

        if (this.elements.cancelDeleteBtn) {
            this.elements.cancelDeleteBtn.addEventListener('click', () => this.hideDeleteAccountModal());
        }

        if (this.elements.confirmDeleteBtn) {
            this.elements.confirmDeleteBtn.addEventListener('click', () => this.confirmDeleteAccount());
        }
    }
    
    // 页面切换
    switchPage(pageId) {
        // 更新导航按钮状态
        this.elements.navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-page') === pageId);
        });

        // 更新页面显示
        this.elements.pages.forEach(page => {
            page.classList.toggle('active', page.id === `${pageId}-page`);
        });

        // 页面特定初始化
        if (pageId === 'stats') {
            this.initCharts();
        } else if (pageId === 'profile') {
            this.loadUserProfile();
        }
    }
    
    // === 番茄钟核心功能 ===
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.elements.startBtn.disabled = true;
        this.elements.pauseBtn.disabled = false;
        
		// 每秒更新一次进度条
        this.updateProgressBar();
        this.intervalId = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();
            
            if (this.timeLeft <= 0) {
                this.sessionComplete();
            }
        }, 1000);
    }
    
    pause() {
        this.isRunning = false;
        clearInterval(this.intervalId);
        this.elements.startBtn.disabled = false;
        this.elements.pauseBtn.disabled = true;
    }
    
    reset() {
        this.pause();
        this.timeLeft = this.isWorkSession ? this.workDuration : this.breakDuration;
        this.updateDisplay();
    }
    
    skip() {
        this.pause();
        this.switchSession();
    }
    
	// 番茄钟完成处理
    sessionComplete() {
        this.pause();
        this.playNotification();
        
        if (this.isWorkSession) {
            this.sessionsCompleted++;
            this.saveSession();
        }
        
        this.switchSession();
        
        if (Notification.permission === 'granted') {
            const message = this.isWorkSession ? 
                '休息时间到！放松一下吧！' : '休息结束，开始新的工作时段！';
            new Notification('番茄钟提醒', { body: message });
        }
    }
    
    switchSession() {
        this.isWorkSession = !this.isWorkSession;
        
        if (this.isWorkSession) {
            this.timeLeft = this.workDuration;
            this.elements.sessionType.textContent = '工作时段';
        } else {
            const isLongBreak = this.sessionsCompleted > 0 && this.sessionsCompleted % 4 === 0;
            const breakTime = isLongBreak ? this.longBreakDuration : this.breakDuration;
            const breakType = isLongBreak ? '长休息' : '短休息';
            
            this.timeLeft = breakTime;
            this.elements.sessionType.textContent = `${breakType}时段`;
        }
        
        this.updateDisplay();
    }
    
    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.elements.timeDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        this.updateProgressRing();
    }
    
    playNotification() {
        this.elements.notificationSound.currentTime = 0;
        this.elements.notificationSound.play().catch(e => {
            console.log('自动播放被阻止，需要用户交互');
        });
    }
    
	// === 待办事项功能 ===
	async loadTodos() {
	    try {
	        const response = await fetch(this.API_ENDPOINTS.TODOS);
	        if (response.ok) {
	            const result = await response.json();
	            this.displayTodos(result.data);
	        } else {
	            throw new Error('加载失败');
	        }
	    } catch (error) {
	        console.error('加载待办事项失败:', error);
	        // 使用本地模拟数据作为降级方案
	        const mockTodos = [
	            { id: 1, text: '示例任务：学习JavaScript', duration: 25, completed: false },
	            { id: 2, text: '示例任务：阅读文档', duration: 50, completed: true }
	        ];
	        this.displayTodos(mockTodos);
	    }
	}
	
	async addTodo() {
	    const text = this.elements.newTodoInput.value.trim();
	    const duration = parseInt(this.elements.todoDuration.value);
	    
	    if (!text) {
	        this.showNotification('请输入待办事项内容', 'error');
	        return;
	    }
	    
	    if (!duration || duration < 1) {
	        this.showNotification('请输入有效的时长', 'error');
	        return;
	    }
	    
	    try {
	        const response = await fetch(this.API_ENDPOINTS.TODOS, {
	            method: 'POST',
	            headers: {
	                'Content-Type': 'application/json',
	            },
	            body: JSON.stringify({
	                text: text,
	                duration: duration,
	                completed: false
	            })
	        });
	        
	        if (response.ok) {
	            this.elements.newTodoInput.value = '';
	            this.loadTodos();
	            this.showNotification('待办事项添加成功', 'success');
	        } else {
	            throw new Error('添加失败');
	        }
	    } catch (error) {
	        console.error('添加待办事项失败:', error);
	        this.showNotification('添加失败，请重试', 'error');
	    }
	}
	
 
    async loadStats() {
        try {
            const period = this.elements.statsPeriod.value;
            const response = await fetch(`${this.API_ENDPOINTS.STATS}?period=${period}`);
            const result = await response.json();
            
            if (response.ok) {
                this.displayStats(result.data, period);
                this.updateChartsWithStats(result.data, period);
            } else {
                console.error('加载统计失败:', result.error);
                // 使用模拟数据作为降级方案
                this.displayStats([], period);
                this.updateChartsWithStats([], period);
            }
        } catch (error) {
            console.error('网络错误:', error);
            // 使用模拟数据作为降级方案
            const period = this.elements.statsPeriod.value;
            this.displayStats([], period);
            this.updateChartsWithStats([], period);
        }
    }
    
    displayTodos(todos) {
        const pendingContainer = this.elements.pendingTodos;
        const completedContainer = this.elements.completedTodos;
        
        pendingContainer.innerHTML = '';
        completedContainer.innerHTML = '';
        
        if (todos.length === 0) {
            pendingContainer.innerHTML = this.createEmptyState('暂无待办事项');
            completedContainer.innerHTML = this.createEmptyState('暂无已完成事项');
            return;
        }
        
        const pendingTodos = todos.filter(todo => !todo.completed);
        const completedTodos = todos.filter(todo => todo.completed);
        
        if (pendingTodos.length === 0) {
            pendingContainer.innerHTML = this.createEmptyState('所有任务都完成啦！🎉');
        } else {
            pendingTodos.forEach(todo => {
                pendingContainer.appendChild(this.createTodoItem(todo));
            });
        }
        
        if (completedTodos.length === 0) {
            completedContainer.innerHTML = this.createEmptyState('还没有完成的任务');
        } else {
            completedTodos.forEach(todo => {
                completedContainer.appendChild(this.createTodoItem(todo));
            });
        }
    }
    
    createTodoItem(todo) {
        const item = document.createElement('div');
        item.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        item.innerHTML = `
            <div class="todo-content">
                <div class="todo-text">${this.escapeHtml(todo.text)}</div>
                <div class="todo-duration">预计: ${todo.duration} 分钟</div>
            </div>
            <div class="todo-actions">
                ${!todo.completed ? `
                    <button class="todo-btn btn-start" onclick="app.startTodoTimer(${todo.id}, ${todo.duration}, '${this.escapeHtml(todo.text)}')">
                        开始
                    </button>
                    <button class="todo-btn btn-complete" onclick="app.completeTodo(${todo.id})">
                        完成
                    </button>
                ` : ''}
                <button class="todo-btn btn-delete" onclick="app.deleteTodo(${todo.id})">
                    删除
                </button>
            </div>
        `;
        return item;
    }
    
    createEmptyState(message) {
        return `
            <div class="empty-state">
                <div>📝</div>
                <div>${message}</div>
            </div>
        `;
    }
    
    async completeTodo(todoId) {
        try {
            const response = await fetch(`${this.API_ENDPOINTS.TODOS}/${todoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ completed: true })
            });
            
            if (response.ok) {
                this.loadTodos();
                this.showNotification('任务标记为完成', 'success');
            }
        } catch (error) {
            console.error('完成任务失败:', error);
            this.showNotification('操作失败，请重试', 'error');
        }
    }
    
    async deleteTodo(todoId) {
        if (!confirm('确定要删除这个待办事项吗？')) return;
        
        try {
            const response = await fetch(`${this.API_ENDPOINTS.TODOS}/${todoId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.loadTodos();
                this.showNotification('待办事项已删除', 'success');
            }
        } catch (error) {
            console.error('删除待办事项失败:', error);
            this.showNotification('删除失败，请重试', 'error');
        }
    }
    
    startTodoTimer(duration, taskText) {
        // 切换到番茄钟页面
        this.switchPage('pomodoro');
        
        // 设置任务输入
        this.elements.taskInput.value = taskText;
        this.elements.taskLength.textContent = `${taskText.length}/50`;
        
        // 设置自定义时长
        this.workDuration = duration * 60;
        this.timeLeft = this.workDuration;
        this.updateDisplay();
        
        this.showNotification(`已设置为 ${duration} 分钟专注任务`, 'info');
    }
	    // === 统计图表功能 ===
	    initCharts() {
	        // 销毁现有图表
	        Object.values(this.charts).forEach(chart => {
	            if (chart) chart.destroy();
	        });
	        
	        // 获取当前周期
	        const period = this.elements.statsPeriod.value;
	        const chartData = this.generateChartData([], period);
	        
	        console.log('初始化图表，周期:', period, '数据:', chartData);
	        
	        // 初始化新图表
	        this.charts.duration = this.createDurationChart(chartData.duration);
	        this.charts.monthly = this.createMonthlyChart(chartData.time, chartData.labels);
	        this.charts.hourly = this.createHourlyChart(chartData.hourly);
	        this.charts.yearly = this.createYearlyChart(chartData.trend, this.getYearLabels(period));
	    }
	    
	    createDurationChart(data = [12, 8, 4, 2]) {
	        const ctx = this.elements.durationChart.getContext('2d');
	        return new Chart(ctx, {
	            type: 'doughnut',
	            data: {
	                labels: ['25分钟', '50分钟', '75分钟', '100分钟+'],
	                datasets: [{
	                    data: data, // 使用传入的数据
	                    backgroundColor: [
	                        '#ff6b6b',
	                        '#4ecdc4',
	                        '#45b7d1',
	                        '#96ceb4'
	                    ]
	                }]
	            },
	            options: {
	                responsive: true,
	                plugins: {
	                    legend: {
	                        position: 'bottom'
	                    },
	                    title: {
	                        display: true,
	                        text: '专注时长分布'
	                    }
	                }
	            }
	        });
	    }
	    
	    createMonthlyChart(data = [], labels = []) {
	        const ctx = this.elements.monthlyChart.getContext('2d');
	        return new Chart(ctx, {
	            type: 'bar',
	            data: {
	                labels: labels, // 使用传入的标签
	                datasets: [{
	                    label: '专注时长(分钟)',
	                    data: data, // 使用传入的数据
	                    backgroundColor: '#667eea'
	                }]
	            },
	            options: {
	                responsive: true,
	                plugins: {
	                    title: {
	                        display: true,
	                        text: '专注时间统计'
	                    }
	                },
	                scales: {
	                    y: {
	                        beginAtZero: true,
	                        title: {
	                            display: true,
	                            text: '分钟'
	                        }
	                    },
	                    x: {
	                        title: {
	                            display: true,
	                            text: this.getTimeUnit()
	                        }
	                    }
	                }
	            }
	        });
	    }
	    
	    createHourlyChart(data = []) {
	        const ctx = this.elements.hourlyChart.getContext('2d');
	        return new Chart(ctx, {
	            type: 'line',
	            data: {
	                labels: ['6点', '8点', '10点', '12点', '14点', '16点', '18点', '20点', '22点'],
	                datasets: [{
	                    label: '专注时段分布',
	                    data: data, // 使用传入的数据
	                    borderColor: '#ff6b6b',
	                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
	                    tension: 0.4,
	                    fill: true
	                }]
	            },
	            options: {
	                responsive: true,
	                plugins: {
	                    title: {
	                        display: true,
	                        text: '专注时段分布'
	                    }
	                },
	                scales: {
	                    y: {
	                        beginAtZero: true,
	                        title: {
	                            display: true,
	                            text: '专注次数'
	                        }
	                    },
	                    x: {
	                        title: {
	                            display: true,
	                            text: '时间段'
	                        }
	                    }
	                }
	            }
	        });
	    }
	    
	    createYearlyChart(data = [], labels = []) {
	        const ctx = this.elements.yearlyChart.getContext('2d');
	        return new Chart(ctx, {
	            type: 'line',
	            data: {
	                labels: labels, // 使用传入的标签
	                datasets: [{
	                    label: '专注趋势',
	                    data: data, // 使用传入的数据
	                    borderColor: '#4ecdc4',
	                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
	                    tension: 0.4,
	                    fill: true
	                }]
	            },
	            options: {
	                responsive: true,
	                plugins: {
	                    title: {
	                        display: true,
	                        text: '专注趋势'
	                    }
	                },
	                scales: {
	                    y: {
	                        beginAtZero: true,
	                        title: {
	                            display: true,
	                            text: '分钟'
	                        }
	                    }
	                }
	            }
	        });
	    }
	    
	    // 发送预设消息（避免竞态条件）
	    async sendQuickMessage(message) {
	        if (!message) return;

	        // 添加用户消息到聊天界面
	        this.addChatMessage('你', message, new Date().toLocaleTimeString(), 'ai');

	        // 禁用发送按钮防止重复发送
	        this.elements.aiSendBtn.disabled = true;
	        this.elements.aiSendBtn.textContent = '发送中...';

	        // 显示正在输入指示器
	        this.showTypingIndicator('ai');

	        try {
	            // 添加超时控制
	            const timeoutPromise = new Promise((_, reject) =>
	                setTimeout(() => reject(new Error('请求超时')), 20000)
	            );

	            const fetchPromise = fetch(this.API_ENDPOINTS.CHAT, {
	                method: 'POST',
	                headers: {
	                    'Content-Type': 'application/json',
	                },
	                body: JSON.stringify({
	                    message: message
	                })
	            });

	            const response = await Promise.race([fetchPromise, timeoutPromise]);
	            const result = await response.json();

	            // 移除输入指示器
	            this.hideTypingIndicator('ai');

	            // 恢复发送按钮
	            this.elements.aiSendBtn.disabled = false;
	            this.elements.aiSendBtn.textContent = '发送';

	            if (result.success) {
	                this.addChatMessage('AI学习伙伴', result.reply, result.timestamp, 'ai', 'ai');
	            } else {
	                this.addChatMessage('系统', result.reply, result.timestamp, 'ai', 'system');
	                this.showNotification('AI服务暂时不可用', 'error');
	            }
	        } catch (error) {
	            // 移除输入指示器
	            this.hideTypingIndicator('ai');

	            // 恢复发送按钮
	            this.elements.aiSendBtn.disabled = false;
	            this.elements.aiSendBtn.textContent = '发送';

	            console.error('AI聊天错误:', error);

	            let errorMessage = '网络错误，请检查连接后重试';
	            if (error.message === '请求超时') {
	                errorMessage = '请求超时，请稍后重试或简化问题';
	            }

	            this.addChatMessage('系统', errorMessage, new Date().toLocaleTimeString(), 'ai', 'system');
	            this.showNotification('AI服务响应超时', 'error');
	        }
	    }

	    // === AI学习伙伴功能 - 优化版本 ===
	    async sendAIMessage() {
	        const message = this.elements.aiMessageInput.value.trim();
	        if (!message) return;
	        
	        // 添加用户消息到聊天界面
	        this.addChatMessage('你', message, new Date().toLocaleTimeString(), 'ai');
	        this.elements.aiMessageInput.value = '';
	        
	        // 禁用发送按钮防止重复发送
	        this.elements.aiSendBtn.disabled = true;
	        this.elements.aiSendBtn.textContent = '发送中...';
	        
	        // 显示正在输入指示器
	        this.showTypingIndicator('ai');
	        
	        try {
	            // 添加超时控制
	            const timeoutPromise = new Promise((_, reject) => 
	                setTimeout(() => reject(new Error('请求超时')), 20000)
	            );
	            
	            const fetchPromise = fetch(this.API_ENDPOINTS.CHAT, {
	                method: 'POST',
	                headers: {
	                    'Content-Type': 'application/json',
	                },
	                body: JSON.stringify({
	                    message: message
	                })
	            });
	            
	            const response = await Promise.race([fetchPromise, timeoutPromise]);
	            const result = await response.json();
	            
	            // 移除输入指示器
	            this.hideTypingIndicator('ai');
	            
	            // 恢复发送按钮
	            this.elements.aiSendBtn.disabled = false;
	            this.elements.aiSendBtn.textContent = '发送';
	            
            if (result.success) {
                this.addChatMessage('AI学习伙伴', result.reply, result.timestamp, 'ai', 'ai');
            } else {
                this.addChatMessage('系统', result.reply, result.timestamp, 'ai', 'system');
                this.showNotification('AI服务暂时不可用', 'error');
            }
	        } catch (error) {
	            // 移除输入指示器
	            this.hideTypingIndicator('ai');
	            
	            // 恢复发送按钮
	            this.elements.aiSendBtn.disabled = false;
	            this.elements.aiSendBtn.textContent = '发送';
	            
	            console.error('AI聊天错误:', error);
	            
	            let errorMessage = '网络错误，请检查连接后重试';
	            if (error.message === '请求超时') {
	                errorMessage = '请求超时，请稍后重试或简化问题';
	            }
	            
	            this.addChatMessage('系统', errorMessage, new Date().toLocaleTimeString(), 'ai', 'system');
	            this.showNotification('AI服务响应超时', 'error');
	        }
	    }
	    
		
	    // === 虚拟自习室功能 ===
	    initWebSocket() {
	        this.socket = io();
	        
	        // 处理连接事件
	        this.socket.on('connect', () => {
	            console.log('已连接到自习室服务器');
	        });
	        
	        this.socket.on('disconnect', () => {
	            console.log('与自习室服务器断开连接');
	            this.addSystemMessage('与服务器连接已断开', 'room');
	        });
	        
	        // 处理自习室消息
	        this.socket.on('user-joined', (data) => {
	            this.addSystemMessage(data.message, 'room');
	        });
	        
	        this.socket.on('user-left', (data) => {
	            this.addSystemMessage(data.message, 'room');
	        });
	        
	        this.socket.on('new-message', (data) => {
	            this.addChatMessage(data.username, data.message, data.timestamp, 'room');
	        });
	        
	        this.socket.on('room-users', (users) => {
	            this.updateRoomUsers(users);
	        });
	    }
	    
	    joinRoom() {
	        const username = this.elements.usernameInput.value.trim();
	        let roomId = this.elements.roomIdInput.value.trim();
	        
	        if (!username) {
	            alert('请输入昵称');
	            return;
	        }
	        
	        if (!roomId) {
	            roomId = 'default-room';
	            this.elements.roomIdInput.value = roomId;
	        }
	        
	        this.username = username;
	        this.currentRoom = roomId;
	        
	        // 加入房间
	        this.socket.emit('join-room', {
	            roomId: roomId,
	            username: username
	        });
	        
	        // 显示自习室内容
	        this.elements.roomContent.style.display = 'block';
	        this.addSystemMessage(`你加入了房间: ${roomId}`, 'room');
	    }
	    
	    createRoom() {
	        const username = this.elements.usernameInput.value.trim();
	        if (!username) {
	            alert('请输入昵称');
	            return;
	        }

	        // 检查用户是否输入了房间ID，如果没有则生成随机ID
	        let roomId = this.elements.roomIdInput.value.trim();
	        if (!roomId) {
	            // 生成随机房间ID
	            roomId = 'room-' + Math.random().toString(36).substr(2, 8);
	            this.elements.roomIdInput.value = roomId;
	        }

	        this.joinRoom();
	    }
	    
	    sendRoomMessage() {
	        if (!this.currentRoom || !this.username) {
	            alert('请先加入房间');
	            return;
	        }
	        
	        const message = this.elements.roomMessageInput.value.trim();
	        if (!message) return;
	        
	        this.socket.emit('send-message', {
	            message: message
	        });
	        
	        this.elements.roomMessageInput.value = '';
	    }
	    
    // === 通用聊天功能 ===
    addChatMessage(sender, message, timestamp, type, messageType = 'user') {
        const messagesContainer = type === 'ai' ?
            this.elements.aiChatMessages : this.elements.roomChatMessages;

        const messageWrapper = document.createElement('div');
        messageWrapper.className = `message-wrapper ${messageType}-message`;

        let avatarEmoji = '👤';
        if (messageType === 'ai') {
            avatarEmoji = '🤖';
        } else if (messageType === 'system') {
            avatarEmoji = '💬';
        }

        if (type === 'ai') {
            messageWrapper.innerHTML = `
                <div class="message-avatar">${avatarEmoji}</div>
                <div class="message-bubble">
                    <div class="message-content">${this.escapeHtml(message)}</div>
                    <div class="message-time">${timestamp}</div>
                </div>
            `;
        } else {
            // 自习室消息
            messageWrapper.innerHTML = `
                <div class="message-avatar">${avatarEmoji}</div>
                <div class="message-bubble">
                    <div class="message-username">${sender}</div>
                    <div class="message-content">${this.escapeHtml(message)}</div>
                    <div class="message-time">${timestamp}</div>
                </div>
            `;
        }

        messagesContainer.appendChild(messageWrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
	    
	    addSystemMessage(message, type) {
	        const messagesContainer = type === 'ai' ?
	            this.elements.aiChatMessages : this.elements.roomChatMessages;

	        const messageWrapper = document.createElement('div');
	        messageWrapper.className = 'message-wrapper system-message';

	        messageWrapper.innerHTML = `
	            <div class="message-bubble system-bubble">
	                <div class="message-content">${this.escapeHtml(message)}</div>
	                <div class="message-time">${new Date().toLocaleTimeString()}</div>
	            </div>
	        `;

	        messagesContainer.appendChild(messageWrapper);
	        messagesContainer.scrollTop = messagesContainer.scrollHeight;
	    }
	    
	    showTypingIndicator(type) {
	        const messagesContainer = type === 'ai' ?
	            this.elements.aiChatMessages : this.elements.roomChatMessages;

	        const messageWrapper = document.createElement('div');
	        messageWrapper.className = 'message-wrapper ai-message';

	        messageWrapper.innerHTML = `
	            <div class="message-avatar">🤖</div>
	            <div class="message-bubble">
	                <div class="typing-indicator">
	                    <div class="typing-dots">
	                        <span></span>
	                        <span></span>
	                        <span></span>
	                    </div>
	                    <div class="typing-text">AI正在思考...</div>
	                </div>
	            </div>
	        `;

	        messageWrapper.id = `${type}-typing`;
	        messagesContainer.appendChild(messageWrapper);
	        messagesContainer.scrollTop = messagesContainer.scrollHeight;
	    }
	    
	    hideTypingIndicator(type) {
	        const indicator = document.getElementById(`${type}-typing`);
	        if (indicator) {
	            indicator.remove();
	        }
	    }
	    
	    updateRoomUsers(users) {
	        const usersList = this.elements.roomUsersList;
	        usersList.innerHTML = '';
	        
	        users.forEach(user => {
	            const userEl = document.createElement('div');
	            userEl.className = 'room-user';
	            userEl.innerHTML = `
	                <div class="user-name">${user.username}</div>
	                <div class="user-status">${user.status}</div>
	            `;
	            usersList.appendChild(userEl);
	        });
	    }
	    
	    // === 通知功能 ===
	    showNotification(message, type = 'info') {
	        // 创建通知元素
	        const notification = document.createElement('div');
	        notification.className = `notification ${type}`;
	        notification.textContent = message;
	        
	        document.body.appendChild(notification);
	        
	        // 显示通知
	        setTimeout(() => notification.classList.add('show'), 100);
	        
	        // 自动隐藏
	        setTimeout(() => {
	            notification.classList.remove('show');
	            setTimeout(() => notification.remove(), 300);
	        }, 3000);
	    }
	    
	    // === 原有的API调用 ===
	    async saveSession() {
	        const taskName = this.elements.taskInput.value.trim() || '未命名任务';
	        
	        try {
	            const response = await fetch(this.API_ENDPOINTS.SESSIONS, {
	                method: 'POST',
	                headers: {
	                    'Content-Type': 'application/json',
	                },
	                body: JSON.stringify({
	                    taskName: taskName,
	                    duration: this.workDuration / 60,
	                    sessionType: 'work'
	                })
	            });
	            
	            const result = await response.json();
	            if (response.ok) {
	                console.log('记录保存成功:', result);
	                this.loadHistory();
	                this.loadStats();
	            } else {
	                console.error('保存失败:', result.error);
	            }
	        } catch (error) {
	            console.error('网络错误:', error);
	        }
	    }
	    
	    async loadHistory() {
	        try {
	            const response = await fetch(this.API_ENDPOINTS.SESSIONS);
	            const result = await response.json();
	            
	            if (response.ok) {
	                this.displayHistory(result.data);
	            } else {
	                console.error('加载历史记录失败:', result.error);
	            }
	        } catch (error) {
	            console.error('网络错误:', error);
	            this.displayHistory([]);
	        }
	    }
	    
	    displayHistory(sessions) {
			const historyList = this.elements.historyList;
			historyList.innerHTML = '';
    
			this.elements.recordCount.textContent = `共 ${sessions.length} 条记录`;
    
			if (sessions.length === 0) {
				historyList.innerHTML = '<div class="empty-state">暂无学习记录</div>';
				return;
			}
	        
	        sessions.forEach(session => {
	            const item = document.createElement('div');
	            item.className = 'history-item';
	            
	            const beijingDate = new Date(session.completed_at);
	            const displayDate = beijingDate.toLocaleDateString('zh-CN');
	            const displayTime = beijingDate.toLocaleTimeString('zh-CN', {
	                hour: '2-digit',
	                minute: '2-digit',
	                hour12: false
	            });
	            
	            item.innerHTML = `
	                <div class="history-task">${session.task_name}</div>
	                <div class="history-details">
	                    ${session.duration}分钟 • ${displayDate} ${displayTime}
	                </div>
	            `;
	            
	            historyList.appendChild(item);
	        });
	    }
	    
	    async loadStats() {
	        try {
	            const response = await fetch(this.API_ENDPOINTS.STATS);
	            const result = await response.json();
	            
	            if (response.ok) {
	                this.displayStats(result.data);
	            } else {
	                console.error('加载统计失败:', result.error);
	            }
	        } catch (error) {
	            console.error('网络错误:', error);
	        }
	    }
	    
	    // 更新显示统计方法
	    displayStats(stats, period = 'week') {
	        // 计算总统计
	        const totalSessions = stats.reduce((sum, stat) => sum + (stat.total_sessions || 0), 0);
	        const totalMinutes = stats.reduce((sum, stat) => sum + (stat.total_minutes || 0), 0);
	        
	        this.elements.totalSessions.textContent = totalSessions;
	        this.elements.totalMinutes.textContent = totalMinutes;
	        
	        // 当日统计
	        const today = new Date().toISOString().split('T')[0];
	        const todayStat = stats.find(stat => stat.date === today);
	        
	        if (todayStat) {
	            this.elements.todaySessions.textContent = todayStat.total_sessions || 0;
	            this.elements.todayMinutes.textContent = todayStat.total_minutes || 0;
	        } else {
	            this.elements.todaySessions.textContent = '0';
	            this.elements.todayMinutes.textContent = '0';
	        }
	        
	        // 计算平均统计
	        const daysCount = Math.max(stats.length, 1);
	        this.elements.avgSessions.textContent = Math.round(totalSessions / daysCount);
	        this.elements.avgMinutes.textContent = Math.round(totalMinutes / daysCount);
	        
	        // 更新快速统计
	        this.updateQuickStats(stats);
	    }
	    
	    // 更新快速统计
	    updateQuickStats(stats) {
	        // 最长专注时间
	        const longest = Math.max(...stats.map(stat => stat.total_minutes || 0), 0);
	        this.elements.longestSession.textContent = `${longest} 分钟`;
	        
	        // 连续天数（简化计算）
	        const sortedDates = stats.map(stat => stat.date).sort();
	        let streak = 1;
	        for (let i = 1; i < sortedDates.length; i++) {
	            const prevDate = new Date(sortedDates[i-1]);
	            const currDate = new Date(sortedDates[i]);
	            const diffTime = Math.abs(currDate - prevDate);
	            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	            if (diffDays === 1) streak++;
	            else break;
	        }
	        this.elements.streakDays.textContent = `${streak} 天`;
	        
	        // 完成率（简化计算）
	        const completion = stats.length > 0 ? Math.round((stats.filter(stat => stat.total_sessions > 0).length / stats.length) * 100) : 0;
	        this.elements.completionRate.textContent = `${completion}%`;
	        
	        // 最佳时段（简化）
	        this.elements.bestHour.textContent = '上午 9-11点';
	    }
	    
	    updateChartsWithStats(stats, period) {
	        // 根据周期生成不同的图表数据
	        const chartData = this.generateChartData(stats, period);
	        
	        // 更新所有图表
	        this.updateDurationChart(chartData.duration);
	        this.updateTimeChart(chartData.time);
	        this.updateTrendChart(chartData.trend);
	        this.updateHourlyChart(chartData.hourly);
	    }
	    
	    // 生成图表数据
	    generateChartData(stats, period) {
	        // 模拟数据生成 - 实际应该基于真实的stats数据
	        switch (period) {
	            case 'week':
	                return {
	                    duration: [15, 8, 5, 2], // 25min, 50min, 75min, 100min+
	                    time: [120, 80, 150, 90, 180, 120, 160], // 一周7天
	                    trend: [25, 30, 45, 35, 50, 40, 55], // 一周趋势
	                    hourly: [5, 25, 40, 15, 35, 45, 20, 30, 10], // 时段分布
	                    labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
	                };
	            case 'month':
	                return {
	                    duration: [45, 25, 15, 8],
	                    time: [1200, 800, 1500, 900, 1800, 1200, 1600, 1400, 1100, 1300, 900, 1000, 1200, 800, 1500, 900, 1800, 1200, 1600, 1400, 1100, 1300, 900, 1000, 1200, 800, 1500, 900, 1800, 1200],
	                    trend: [800, 1200, 1500, 1800, 2200, 2500, 2800, 3000, 3200, 3500, 3800, 4000, 4200, 4500, 4800, 5000, 5200, 5500, 5800, 6000, 6200, 6500, 6800, 7000, 7200, 7500, 7800, 8000, 8200, 8500],
	                    hourly: [8, 35, 50, 20, 45, 55, 25, 40, 15],
	                    labels: Array.from({length: 30}, (_, i) => `${i + 1}号`)
	                };
	            case 'year':
	                return {
	                    duration: [180, 100, 60, 30],
	                    time: [1200, 800, 1500, 900, 1800, 1200, 1600, 1400, 1100, 1300, 900, 1000],
	                    trend: [8000, 12000, 15000, 18000, 22000, 25000, 28000, 32000, 35000, 38000, 42000, 45000],
	                    hourly: [10, 40, 55, 25, 50, 60, 30, 45, 20],
	                    labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
	                };
	            default:
	                return {
	                    duration: [12, 8, 4, 2],
	                    time: [120, 80, 150, 90, 180, 120, 160],
	                    trend: [25, 30, 45, 35, 50, 40, 55],
	                    hourly: [5, 25, 40, 15, 35, 45, 20, 30, 10],
	                    labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
	                };
	        }
	    }
	    
		// 更新专注时长分布图
		updateDurationChart(data) {
		    if (this.charts.duration) {
		        this.charts.duration.data.datasets[0].data = data;
		        this.charts.duration.update();
		    }
		}
		
		// 更新时间趋势图（月度统计）
		updateTimeChart(data) {
		    if (this.charts.monthly) {
		        this.charts.monthly.data.datasets[0].data = data;
		        this.charts.monthly.update();
		    }
		}
		
		// 更新趋势图（年度统计）
		updateTrendChart(data) {
		    if (this.charts.yearly) {
		        this.charts.yearly.data.datasets[0].data = data;
		        this.charts.yearly.update();
		    }
		}
		
		// 更新时段分布图
		updateHourlyChart(data) {
		    if (this.charts.hourly) {
		        this.charts.hourly.data.datasets[0].data = data;
		        this.charts.hourly.update();
		    }
		}
		
		initCharts() {
		    // 销毁现有图表
		    Object.values(this.charts).forEach(chart => {
		        if (chart) chart.destroy();
		    });
		    
		    // 获取当前周期
		    const period = this.elements.statsPeriod.value;
		    const chartData = this.generateChartData([], period);
		    
		    // 初始化新图表
		    this.charts.duration = this.createDurationChart(chartData.duration);
		    this.charts.monthly = this.createMonthlyChart(chartData.time, chartData.labels);
		    this.charts.hourly = this.createHourlyChart(chartData.hourly);
		    this.charts.yearly = this.createYearlyChart(chartData.trend, this.getYearLabels(period));
		}
		
		// 创建图表的方法需要接受参数
		createDurationChart(data = [12, 8, 4, 2]) {
		    const ctx = this.elements.durationChart.getContext('2d');
		    return new Chart(ctx, {
		        type: 'doughnut',
		        data: {
		            labels: ['25分钟', '50分钟', '75分钟', '100分钟+'],
		            datasets: [{
		                data: data,
		                backgroundColor: [
		                    '#ff6b6b',
		                    '#4ecdc4',
		                    '#45b7d1',
		                    '#96ceb4'
		                ]
		            }]
		        },
		        options: {
		            responsive: true,
		            plugins: {
		                legend: {
		                    position: 'bottom'
		                },
		                title: {
		                    display: true,
		                    text: '专注时长分布'
		                }
		            }
		        }
		    });
		}
		
		createMonthlyChart(data = [], labels = []) {
		    const ctx = this.elements.monthlyChart.getContext('2d');
		    return new Chart(ctx, {
		        type: 'bar',
		        data: {
		            labels: labels,
		            datasets: [{
		                label: '专注时长(分钟)',
		                data: data,
		                backgroundColor: '#667eea'
		            }]
		        },
		        options: {
		            responsive: true,
		            plugins: {
		                title: {
		                    display: true,
		                    text: '专注时间统计'
		                }
		            },
		            scales: {
		                y: {
		                    beginAtZero: true,
		                    title: {
		                        display: true,
		                        text: '分钟'
		                    }
		                },
		                x: {
		                    title: {
		                        display: true,
		                        text: this.getTimeUnit()
		                    }
		                }
		            }
		        }
		    });
		}
		
		createHourlyChart(data = []) {
		    const ctx = this.elements.hourlyChart.getContext('2d');
		    return new Chart(ctx, {
		        type: 'line',
		        data: {
		            labels: ['6点', '8点', '10点', '12点', '14点', '16点', '18点', '20点', '22点'],
		            datasets: [{
		                label: '专注时段分布',
		                data: data,
		                borderColor: '#ff6b6b',
		                backgroundColor: 'rgba(255, 107, 107, 0.1)',
		                tension: 0.4,
		                fill: true
		            }]
		        },
		        options: {
		            responsive: true,
		            plugins: {
		                title: {
		                    display: true,
		                    text: '专注时段分布'
		                }
		            },
		            scales: {
		                y: {
		                    beginAtZero: true,
		                    title: {
		                        display: true,
		                        text: '专注次数'
		                    }
		                },
		                x: {
		                    title: {
		                        display: true,
		                        text: '时间段'
		                    }
		                }
		            }
		        }
		    });
		}
		
		createYearlyChart(data = [], labels = []) {
		    const ctx = this.elements.yearlyChart.getContext('2d');
		    return new Chart(ctx, {
		        type: 'line',
		        data: {
		            labels: labels,
		            datasets: [{
		                label: '专注趋势',
		                data: data,
		                borderColor: '#4ecdc4',
		                backgroundColor: 'rgba(78, 205, 196, 0.1)',
		                tension: 0.4,
		                fill: true
		            }]
		        },
		        options: {
		            responsive: true,
		            plugins: {
		                title: {
		                    display: true,
		                    text: '专注趋势'
		                }
		            },
		            scales: {
		                y: {
		                    beginAtZero: true,
		                    title: {
		                        display: true,
		                        text: '分钟'
		                    }
		                }
		            }
		        }
		    });
		}
		
		// 辅助方法：获取时间单位标签
		getTimeUnit() {
		    const period = this.elements.statsPeriod.value;
		    switch (period) {
		        case 'week': return '日期';
		        case 'month': return '日期';
		        case 'year': return '月份';
		        default: return '时间';
		    }
		}
		
		// 辅助方法：获取年份标签
		getYearLabels(period) {
		    if (period === 'year') {
		        return ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
		    } else {
		        const today = new Date();
		        const year = today.getFullYear();
		        return Array.from({length: 12}, (_, i) => `${i + 1}月`);
		    }
		}
		
	    escapeHtml(text) {
	        const div = document.createElement('div');
	        div.textContent = text;
	        return div.innerHTML;
	    }
		
		// 新的方法：显示图表分析
		showChartAnalysis() {
		    const period = this.elements.statsPeriod.value;
		    const periodText = this.elements.statsPeriod.options[this.elements.statsPeriod.selectedIndex].text;

		    this.elements.chartPeriod.textContent = periodText;
		    this.switchPage('charts');
		    this.initCharts();
		}

		// === 个人中心功能 ===

		// 加载用户资料
		async loadUserProfile() {
		    // 首先检查是否有token
		    const token = this.authService.getToken();
		    if (!token) {
		        console.log('没有找到认证token');
		        this.showNotification('请先登录后再访问个人中心', 'error');
		        // 延迟跳转到登录页面
		        setTimeout(() => {
		            window.location.href = 'login.html';
		        }, 2000);
		        return;
		    }

		    try {
		        console.log('正在加载用户资料...');
		        const response = await fetch('/api/auth/profile', {
		            method: 'GET',
		            headers: this.authService.getAuthHeaders()
		        });

		        const result = await response.json();

		        if (response.ok) {
		            console.log('用户资料加载成功:', result.user);
		            this.displayUserProfile(result.user);
		        } else {
		            console.error('加载用户资料失败:', result.error);
		            this.showNotification('加载用户资料失败: ' + result.error, 'error');
		            // 如果是认证错误，跳转到登录页面
		            if (response.status === 401 || response.status === 403) {
		                setTimeout(() => {
		                    window.location.href = 'login.html';
		                }, 2000);
		            }
		        }
		    } catch (error) {
		        console.error('加载用户资料错误:', error);
		        this.showNotification('网络错误，无法加载用户资料', 'error');
		    }
		}

		// 显示用户资料
		displayUserProfile(user) {
		    if (this.elements.userUsername) {
		        this.elements.userUsername.textContent = user.username;
		    }
		    if (this.elements.userEmail) {
		        this.elements.userEmail.textContent = user.email;
		    }
		    if (this.elements.userCreatedAt) {
		        // 格式化注册时间
		        const createdAt = new Date(user.created_at);
		        const formattedDate = createdAt.toLocaleDateString('zh-CN', {
		            year: 'numeric',
		            month: 'long',
		            day: 'numeric',
		            hour: '2-digit',
		            minute: '2-digit'
		        });
		        this.elements.userCreatedAt.textContent = formattedDate;
		    }
		}

		// 处理修改密码
		async handleChangePassword() {
		    const oldPassword = this.elements.oldPassword ? this.elements.oldPassword.value : '';
		    const newPassword = this.elements.newPassword ? this.elements.newPassword.value : '';
		    const confirmPassword = this.elements.confirmNewPassword ? this.elements.confirmNewPassword.value : '';

		    // 清空之前的错误信息
		    this.clearPasswordErrors();

		    // 验证输入
		    if (!oldPassword || !newPassword || !confirmPassword) {
		        this.showPasswordError('old-password', '请填写所有密码字段');
		        return;
		    }

		    if (newPassword.length < 6) {
		        this.showPasswordError('new-password', '新密码至少需要6个字符');
		        return;
		    }

		    if (newPassword !== confirmPassword) {
		        this.showPasswordError('confirm-new-password', '两次输入的新密码不一致');
		        return;
		    }

		    if (oldPassword === newPassword) {
		        this.showPasswordError('new-password', '新密码不能与旧密码相同');
		        return;
		    }

		    // 显示加载状态
		    this.setPasswordLoading(true);

		    try {
		        const response = await fetch('/api/auth/change-password', {
		            method: 'PUT',
		            headers: this.authService.getAuthHeaders(),
		            body: JSON.stringify({
		                oldPassword: oldPassword,
		                newPassword: newPassword
		            })
		        });

		        const result = await response.json();

		        if (response.ok) {
		            this.showNotification('密码修改成功！', 'success');
		            // 清空表单
		            if (this.elements.changePasswordForm) {
		                this.elements.changePasswordForm.reset();
		            }
		        } else {
		            this.showPasswordError('old-password', result.error || '密码修改失败');
		        }
		    } catch (error) {
		        console.error('修改密码错误:', error);
		        this.showPasswordError('old-password', '网络错误，请稍后重试');
		    } finally {
		        this.setPasswordLoading(false);
		    }
		}

		// 显示退出登录模态框
		showLogoutModal() {
		    if (this.elements.logoutModal) {
		        this.elements.logoutModal.style.display = 'flex';
		    }
		}

		// 隐藏退出登录模态框
		hideLogoutModal() {
		    if (this.elements.logoutModal) {
		        this.elements.logoutModal.style.display = 'none';
		    }
		}

		// 确认退出登录
		confirmLogout() {
		    this.authService.logout();
		}

		// 显示注销账号模态框
		showDeleteAccountModal() {
		    if (this.elements.deleteAccountModal) {
		        this.elements.deleteAccountModal.style.display = 'flex';
		        // 清空密码输入
		        if (this.elements.deleteConfirmPassword) {
		            this.elements.deleteConfirmPassword.value = '';
		        }
		        this.clearDeletePasswordError();
		    }
		}

		// 隐藏注销账号模态框
		hideDeleteAccountModal() {
		    if (this.elements.deleteAccountModal) {
		        this.elements.deleteAccountModal.style.display = 'none';
		    }
		}

		// 确认注销账号
		async confirmDeleteAccount() {
		    const password = this.elements.deleteConfirmPassword ? this.elements.deleteConfirmPassword.value.trim() : '';

		    if (!password) {
		        this.showDeletePasswordError('请输入密码');
		        return;
		    }

		    // 显示加载状态
		    this.setDeleteLoading(true);

		    try {
		        const response = await fetch('/api/auth/delete-account', {
		            method: 'DELETE',
		            headers: this.authService.getAuthHeaders(),
		            body: JSON.stringify({
		                confirmPassword: password
		            })
		        });

		        const result = await response.json();

		        if (response.ok) {
		            this.showNotification('账号已成功注销，所有数据已被删除', 'success');
		            // 清除本地认证信息并跳转
		            setTimeout(() => {
		                this.authService.logout();
		            }, 2000);
		        } else {
		            this.showDeletePasswordError(result.error || '注销失败');
		        }
		    } catch (error) {
		        console.error('注销账号错误:', error);
		        this.showDeletePasswordError('网络错误，请稍后重试');
		    } finally {
		        this.setDeleteLoading(false);
		    }
		}

		// 显示密码错误信息
		showPasswordError(field, message) {
		    const errorElement = document.getElementById(`${field}-error`);
		    if (errorElement) {
		        errorElement.textContent = message;
		        errorElement.style.display = 'block';
		    }
		}

		// 清空密码错误信息
		clearPasswordErrors() {
		    const errorElements = document.querySelectorAll('#change-password-form .error-message');
		    errorElements.forEach(element => {
		        element.textContent = '';
		        element.style.display = 'none';
		    });
		}

		// 显示注销密码错误信息
		showDeletePasswordError(message) {
		    const errorElement = document.getElementById('delete-password-error');
		    if (errorElement) {
		        errorElement.textContent = message;
		        errorElement.style.display = 'block';
		    }
		}

		// 清空注销密码错误信息
		clearDeletePasswordError() {
		    const errorElement = document.getElementById('delete-password-error');
		    if (errorElement) {
		        errorElement.textContent = '';
		        errorElement.style.display = 'none';
		    }
		}

		// 设置密码修改加载状态
		setPasswordLoading(loading) {
		    const submitBtn = this.elements.changePasswordBtn;
		    if (submitBtn) {
		        submitBtn.disabled = loading;
		        submitBtn.textContent = loading ? '修改中...' : '修改密码';
		    }
		}

		// 设置注销账号加载状态
		setDeleteLoading(loading) {
		    const confirmBtn = this.elements.confirmDeleteBtn;
		    if (confirmBtn) {
		        confirmBtn.disabled = loading;
		        confirmBtn.textContent = loading ? '注销中...' : '确认注销';
		    }
		}

	}
	
	// 全局实例
	let app;
	
	// 请求通知权限
	if ('Notification' in window) {
	    Notification.requestPermission();
	}
	
	// 初始化应用
	document.addEventListener('DOMContentLoaded', () => {
	    app = new PomodoroTimer();
	}
);
