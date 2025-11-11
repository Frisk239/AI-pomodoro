const express = require('express');
const cors = require('cors');
const db = require('./database');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 存储在线用户和自习室
const onlineUsers = new Map();
const studyRooms = new Map();

// === WebSocket 连接处理 ===
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 用户加入自习室
    socket.on('join-room', (data) => {
        const { roomId, username } = data;
        
        // 加入房间
        socket.join(roomId);
        
        // 存储用户信息
        onlineUsers.set(socket.id, { username, roomId });
        
        // 初始化房间（如果不存在）
        if (!studyRooms.has(roomId)) {
            studyRooms.set(roomId, new Set());
        }
        studyRooms.get(roomId).add(socket.id);
        
        // 通知房间内其他用户
        socket.to(roomId).emit('user-joined', {
            username,
            message: `${username} 加入了自习室`,
            timestamp: new Date().toLocaleTimeString()
        });
        
        // 发送当前房间用户列表给新用户
        const roomUsers = Array.from(studyRooms.get(roomId)).map(socketId => {
            const user = onlineUsers.get(socketId);
            return { username: user.username, status: '在线' };
        });
        
        socket.emit('room-users', roomUsers);
        console.log(`${username} 加入房间 ${roomId}`);
    });

    // 处理聊天消息
    socket.on('send-message', (data) => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            io.to(user.roomId).emit('new-message', {
                username: user.username,
                message: data.message,
                timestamp: new Date().toLocaleTimeString()
            });
        }
    });

    // 用户断开连接
    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            const { username, roomId } = user;
            
            // 从房间移除
            if (studyRooms.has(roomId)) {
                studyRooms.get(roomId).delete(socket.id);
                
                // 通知其他用户
                socket.to(roomId).emit('user-left', {
                    username,
                    message: `${username} 离开了自习室`,
                    timestamp: new Date().toLocaleTimeString()
                });
            }
            
            onlineUsers.delete(socket.id);
            console.log(`${username} 断开连接`);
        }
    });
});

// === 原有的番茄钟API路由 ===

// 1. 获取所有番茄钟记录
app.get('/api/sessions', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM pomodoro_sessions ORDER BY completed_at DESC');
        const rows = stmt.all();
        
        res.json({
            message: '成功获取番茄钟记录',
            data: rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. 保存新的番茄钟记录
app.post('/api/sessions', (req, res) => {
    const { taskName, duration, sessionType = 'work' } = req.body;
    
    if (!taskName || !duration) {
        return res.status(400).json({ error: '任务名称和时长是必填项' });
    }
    
    try {
        const now = new Date();
        const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const formattedTime = beijingTime.toISOString().slice(0, 19).replace('T', ' ');
        
        const stmt = db.prepare(`
            INSERT INTO pomodoro_sessions (task_name, duration, session_type, completed_at) 
            VALUES (?, ?, ?, ?)
        `);
        
        const result = stmt.run(taskName, duration, sessionType, formattedTime);
        
        const getStmt = db.prepare('SELECT * FROM pomodoro_sessions WHERE id = ?');
        const newRecord = getStmt.get(result.lastInsertRowid);
        
        res.json({
            message: '番茄钟记录保存成功',
            data: newRecord
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. 获取统计信息
app.get('/api/stats', (req, res) => {
    const period = req.query.period || 'week';
    
    try {
        let query, params = [];
        
        switch (period) {
            case 'week':
                query = `
                    SELECT 
                        COUNT(*) as total_sessions,
                        SUM(duration) as total_minutes,
                        DATE(completed_at) as date
                    FROM pomodoro_sessions 
                    WHERE completed_at >= date('now', '-7 days')
                    GROUP BY DATE(completed_at)
                    ORDER BY date DESC
                `;
                break;
            case 'month':
                query = `
                    SELECT 
                        COUNT(*) as total_sessions,
                        SUM(duration) as total_minutes,
                        DATE(completed_at) as date
                    FROM pomodoro_sessions 
                    WHERE completed_at >= date('now', '-30 days')
                    GROUP BY DATE(completed_at)
                    ORDER BY date DESC
                `;
                break;
            case 'year':
                query = `
                    SELECT 
                        COUNT(*) as total_sessions,
                        SUM(duration) as total_minutes,
                        strftime('%Y-%m', completed_at) as month
                    FROM pomodoro_sessions 
                    WHERE completed_at >= date('now', '-1 year')
                    GROUP BY strftime('%Y-%m', completed_at)
                    ORDER BY month DESC
                `;
                break;
            default:
                query = `
                    SELECT 
                        COUNT(*) as total_sessions,
                        SUM(duration) as total_minutes,
                        DATE(completed_at) as date
                    FROM pomodoro_sessions 
                    GROUP BY DATE(completed_at)
                    ORDER BY date DESC
                    LIMIT 7
                `;
        }
        
        const stmt = db.prepare(query);
        const rows = stmt.all(params);
        
        res.json({
            message: '统计信息获取成功',
            data: rows,
            period: period
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. 删除记录
app.delete('/api/sessions/:id', (req, res) => {
    const id = req.params.id;
    
    try {
        const stmt = db.prepare('DELETE FROM pomodoro_sessions WHERE id = ?');
        const result = stmt.run(id);
        
        res.json({ message: '记录删除成功' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === AI学习伙伴API===
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: '消息内容不能为空' });
    }
    
    console.log('收到AI聊天请求:', message);
    
    const apiKey = process.env.ZHIPU_API_KEY;
    
    if (!apiKey) {
        return res.json({
            success: false,
            reply: "智谱AI服务未配置。",
            timestamp: new Date().toLocaleTimeString()
        });
    }
    
    try {
        // 简单的提示词，只要求基本格式
        const systemPrompt = "请用清晰的方式回答问题，适当使用段落和换行，让内容易于阅读。";

        const requestBody = {
            model: "glm-4-flash",
            messages: [
                { 
                    role: "system", 
                    content: systemPrompt
                },
                { 
                    role: "user", 
                    content: message 
                }
            ],
            max_tokens: 1500,
            temperature: 0.7,
            stream: false
        };

        console.log('发送请求到智谱AI API...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('智谱AI API响应状态:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('智谱AI错误:', errorText);
            throw new Error(`智谱AI API错误 ${response.status}`);
        }
        
        const data = await response.json();
        console.log('智谱AI API响应成功');
        
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            let aiReply = data.choices[0].message.content;
            
            // 简单格式化回复内容
            aiReply = simpleFormatAIResponse(aiReply);
            
            res.json({ 
                success: true,
                reply: aiReply,
                timestamp: new Date().toLocaleTimeString(),
                model: "glm-4-flash"
            });
        } else {
            throw new Error('智谱AI返回数据格式异常');
        }
        
    } catch (error) {
        console.error('AI聊天错误:', error.message);
        
        if (error.name === 'AbortError') {
            return res.json({
                success: false,
                reply: "请求超时，请稍后重试。",
                timestamp: new Date().toLocaleTimeString()
            });
        }
        
        res.json({ 
            success: false,
            reply: "AI服务暂时不可用",
            timestamp: new Date().toLocaleTimeString()
        });
    }
});

// 简单的格式化函数 - 只处理基本换行
function simpleFormatAIResponse(content) {
    if (!content) return content;
    
    let formatted = content;
    
    // 1. 确保代码块有换行
    formatted = formatted.replace(/```/g, '\n```');
    
    // 2. 在句号、感叹号、问号后添加换行（但不要太多）
    formatted = formatted.replace(/([。！？])\s*/g, '$1\n\n');
    
    // 3. 在数字列表前添加换行
    formatted = formatted.replace(/(\n\d+\.)/g, '\n$1');
    
    // 4. 移除过多的连续换行（超过3个的换成2个）
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    return formatted.trim();
}

// 5. 获取所有待办事项
app.get('/api/todos', (req, res) => {
    try {
        // 检查待办事项表是否存在，不存在则创建
        const checkTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                duration INTEGER NOT NULL,
                completed BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        checkTable.run();
        
        const stmt = db.prepare('SELECT * FROM todos ORDER BY completed, created_at DESC');
        const rows = stmt.all();
        
        res.json({
            message: '成功获取待办事项',
            data: rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. 添加新的待办事项
app.post('/api/todos', (req, res) => {
    const { text, duration, completed = false } = req.body;
    
    if (!text || !duration) {
        return res.status(400).json({ error: '事项内容和时长是必填项' });
    }
    
    try {
        const stmt = db.prepare(`
            INSERT INTO todos (text, duration, completed) 
            VALUES (?, ?, ?)
        `);
        
        const result = stmt.run(text, duration, completed ? 1 : 0);
        
        const getStmt = db.prepare('SELECT * FROM todos WHERE id = ?');
        const newTodo = getStmt.get(result.lastInsertRowid);
        
        res.json({
            message: '待办事项添加成功',
            data: newTodo
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. 更新待办事项状态
app.put('/api/todos/:id', (req, res) => {
    const id = req.params.id;
    const { completed, text, duration } = req.body;
    
    try {
        let stmt, result;
        
        if (typeof completed !== 'undefined') {
            stmt = db.prepare('UPDATE todos SET completed = ? WHERE id = ?');
            result = stmt.run(completed ? 1 : 0, id);
        } else if (text && duration) {
            stmt = db.prepare('UPDATE todos SET text = ?, duration = ? WHERE id = ?');
            result = stmt.run(text, duration, id);
        } else {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        
        if (result.changes === 0) {
            return res.status(404).json({ error: '待办事项不存在' });
        }
        
        const getStmt = db.prepare('SELECT * FROM todos WHERE id = ?');
        const updatedTodo = getStmt.get(id);
        
        res.json({
            message: '待办事项更新成功',
            data: updatedTodo
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. 删除待办事项
app.delete('/api/todos/:id', (req, res) => {
    const id = req.params.id;
    
    try {
        const stmt = db.prepare('DELETE FROM todos WHERE id = ?');
        const result = stmt.run(id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: '待办事项不存在' });
        }
        
        res.json({ message: '待办事项删除成功' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`🍅 番茄钟服务器运行在 http://localhost:${PORT}`);
    console.log(`🤖 AI学习伙伴已启用`);
    console.log(`💬 虚拟自习室已启用`);
});