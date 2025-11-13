const express = require('express');
const cors = require('cors');
const db = require('./database');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

// === JWT认证中间件 ===
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: '访问令牌缺失' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '无效的访问令牌' });
        }
        req.user = user;
        next();
    });
};

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

        // 获取更新后的房间用户列表
        const roomUsers = Array.from(studyRooms.get(roomId)).map(socketId => {
            const user = onlineUsers.get(socketId);
            return { username: user.username, status: '在线' };
        });

        // 给房间内的所有用户（包括新用户）发送更新后的用户列表
        io.to(roomId).emit('room-users', roomUsers);

        console.log(`${username} 加入房间 ${roomId}，当前房间用户数: ${roomUsers.length}`);
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

                // 获取更新后的房间用户列表，并发送给剩余用户
                const remainingUsers = Array.from(studyRooms.get(roomId)).map(socketId => {
                    const user = onlineUsers.get(socketId);
                    return { username: user.username, status: '在线' };
                });

                // 给房间内剩余的所有用户发送更新后的用户列表
                io.to(roomId).emit('room-users', remainingUsers);
            }

            onlineUsers.delete(socket.id);
            console.log(`${username} 断开连接`);
        }
    });
});





// === 番茄钟API路由（需要认证）===

// 1. 获取当前用户的番茄钟记录
app.get('/api/sessions', authenticateToken, (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM pomodoro_sessions WHERE user_id = ? ORDER BY completed_at DESC');
        const rows = stmt.all(req.user.id);

        res.json({
            message: '成功获取番茄钟记录',
            data: rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. 保存新的番茄钟记录
app.post('/api/sessions', authenticateToken, (req, res) => {
    const { taskName, duration, sessionType = 'work' } = req.body;

    if (!taskName || !duration) {
        return res.status(400).json({ error: '任务名称和时长是必填项' });
    }

    try {
        const now = new Date();
        const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const formattedTime = beijingTime.toISOString().slice(0, 19).replace('T', ' ');

        const stmt = db.prepare(`
            INSERT INTO pomodoro_sessions (user_id, task_name, duration, session_type, completed_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(req.user.id, taskName, duration, sessionType, formattedTime);

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

// 3. 获取当前用户的统计信息
app.get('/api/stats', authenticateToken, (req, res) => {
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
                    WHERE user_id = ? AND completed_at >= date('now', '-7 days')
                    GROUP BY DATE(completed_at)
                    ORDER BY date DESC
                `;
                params = [req.user.id];
                break;
            case 'month':
                query = `
                    SELECT
                        COUNT(*) as total_sessions,
                        SUM(duration) as total_minutes,
                        DATE(completed_at) as date
                    FROM pomodoro_sessions
                    WHERE user_id = ? AND completed_at >= date('now', '-30 days')
                    GROUP BY DATE(completed_at)
                    ORDER BY date DESC
                `;
                params = [req.user.id];
                break;
            case 'year':
                query = `
                    SELECT
                        COUNT(*) as total_sessions,
                        SUM(duration) as total_minutes,
                        strftime('%Y-%m', completed_at) as month
                    FROM pomodoro_sessions
                    WHERE user_id = ? AND completed_at >= date('now', '-1 year')
                    GROUP BY strftime('%Y-%m', completed_at)
                    ORDER BY month DESC
                `;
                params = [req.user.id];
                break;
            default:
                query = `
                    SELECT
                        COUNT(*) as total_sessions,
                        SUM(duration) as total_minutes,
                        DATE(completed_at) as date
                    FROM pomodoro_sessions
                    WHERE user_id = ?
                    GROUP BY DATE(completed_at)
                    ORDER BY date DESC
                    LIMIT 7
                `;
                params = [req.user.id];
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

// 3.1 获取专注时长分布统计
app.get('/api/stats/duration-distribution', authenticateToken, (req, res) => {
    const period = req.query.period || 'week';

    try {
        let dateFilter = '';

        switch (period) {
            case 'week':
                dateFilter = "completed_at >= date('now', '-7 days')";
                break;
            case 'month':
                dateFilter = "completed_at >= date('now', '-30 days')";
                break;
            case 'year':
                dateFilter = "completed_at >= date('now', '-1 year')";
                break;
            default:
                dateFilter = "1=1"; // 所有记录
        }

        // 统计不同时长区间的专注次数
        const query = `
            SELECT
                CASE
                    WHEN duration <= 25 THEN '25min'
                    WHEN duration <= 50 THEN '50min'
                    WHEN duration <= 75 THEN '75min'
                    ELSE '100min+'
                END as duration_range,
                COUNT(*) as count
            FROM pomodoro_sessions
            WHERE user_id = ? AND ${dateFilter}
            GROUP BY
                CASE
                    WHEN duration <= 25 THEN '25min'
                    WHEN duration <= 50 THEN '50min'
                    WHEN duration <= 75 THEN '75min'
                    ELSE '100min+'
                END
        `;

        const stmt = db.prepare(query);
        const rows = stmt.all(req.user.id);

        // 转换为前端期望的格式 [25min_count, 50min_count, 75min_count, 100min+_count]
        const distribution = [0, 0, 0, 0]; // [25分钟, 50分钟, 75分钟, 100分钟+]

        rows.forEach(row => {
            switch (row.duration_range) {
                case '25min':
                    distribution[0] = row.count;
                    break;
                case '50min':
                    distribution[1] = row.count;
                    break;
                case '75min':
                    distribution[2] = row.count;
                    break;
                case '100min+':
                    distribution[3] = row.count;
                    break;
            }
        });

        res.json({
            message: '专注时长分布获取成功',
            data: distribution,
            period: period
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3.2 获取时段分布统计
app.get('/api/stats/hourly', authenticateToken, (req, res) => {
    const period = req.query.period || 'week';

    try {
        let dateFilter = '';

        switch (period) {
            case 'week':
                dateFilter = "completed_at >= date('now', '-7 days')";
                break;
            case 'month':
                dateFilter = "completed_at >= date('now', '-30 days')";
                break;
            case 'year':
                dateFilter = "completed_at >= date('now', '-1 year')";
                break;
            default:
                dateFilter = "1=1"; // 所有记录
        }

        // 按小时统计专注次数（北京时间）
        const query = `
            SELECT
                strftime('%H', datetime(completed_at, '+8 hours')) as hour,
                COUNT(*) as count
            FROM pomodoro_sessions
            WHERE user_id = ? AND ${dateFilter}
            GROUP BY strftime('%H', datetime(completed_at, '+8 hours'))
            ORDER BY hour
        `;

        const stmt = db.prepare(query);
        const rows = stmt.all(req.user.id);

        // 初始化24小时的数据，默认为0
        const hourlyData = new Array(24).fill(0);

        // 填充实际数据
        rows.forEach(row => {
            const hour = parseInt(row.hour);
            if (hour >= 0 && hour < 24) {
                hourlyData[hour] = row.count;
            }
        });

        // 前端只需要9个时段的数据：6点,8点,10点,12点,14点,16点,18点,20点,22点
        const frontendHours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
        const frontendData = frontendHours.map(hour => hourlyData[hour]);

        res.json({
            message: '时段分布获取成功',
            data: frontendData,
            period: period,
            hours: frontendHours
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3.3 获取任务类型分布统计
app.get('/api/stats/session-types', authenticateToken, (req, res) => {
    const period = req.query.period || 'week';

    try {
        let dateFilter = '';

        switch (period) {
            case 'week':
                dateFilter = "completed_at >= date('now', '-7 days')";
                break;
            case 'month':
                dateFilter = "completed_at >= date('now', '-30 days')";
                break;
            case 'year':
                dateFilter = "completed_at >= date('now', '-1 year')";
                break;
            default:
                dateFilter = "1=1"; // 所有记录
        }

        // 统计工作和休息会话的数量
        const query = `
            SELECT
                session_type,
                COUNT(*) as count
            FROM pomodoro_sessions
            WHERE user_id = ? AND ${dateFilter}
            GROUP BY session_type
        `;

        const stmt = db.prepare(query);
        const rows = stmt.all(req.user.id);

        // 转换为前端期望的格式
        const distribution = {
            work: 0,
            break: 0
        };

        rows.forEach(row => {
            if (row.session_type === 'work') {
                distribution.work = row.count;
            } else if (row.session_type === 'break') {
                distribution.break = row.count;
            }
        });

        res.json({
            message: '任务类型分布获取成功',
            data: distribution,
            period: period
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3.4 获取待办事项统计
app.get('/api/stats/todos', authenticateToken, (req, res) => {
    try {
        // 统计待办事项的完成情况
        const query = `
            SELECT
                completed,
                COUNT(*) as count
            FROM todos
            WHERE user_id = ?
            GROUP BY completed
        `;

        const stmt = db.prepare(query);
        const rows = stmt.all(req.user.id);

        // 转换为前端期望的格式
        const stats = {
            completed: 0,
            pending: 0
        };

        rows.forEach(row => {
            if (row.completed) {
                stats.completed = row.count;
            } else {
                stats.pending = row.count;
            }
        });

        res.json({
            message: '待办事项统计获取成功',
            data: stats
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

// === 用户认证API ===

// 用户注册
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: '用户名、邮箱和密码都是必填项' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少为6位' });
    }

    try {
        // 检查用户名是否已存在
        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }

        // 检查邮箱是否已存在
        const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingEmail) {
            return res.status(400).json({ error: '邮箱已被注册' });
        }

        // 加密密码
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 创建用户
        const stmt = db.prepare(`
            INSERT INTO users (username, email, password_hash)
            VALUES (?, ?, ?)
        `);

        const result = stmt.run(username, email, hashedPassword);
        const userId = result.lastInsertRowid;

        // 生成JWT token
        const token = jwt.sign(
            { id: userId, username, email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: '注册成功',
            token,
            user: { id: userId, username, email }
        });

    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码都是必填项' });
    }

    try {
        // 查找用户
        const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 验证密码
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 生成JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: '登录成功',
            token,
            user: { id: user.id, username: user.username, email: user.email }
        });

    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

// 验证用户登录状态
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    try {
        const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(401).json({ error: '用户不存在或已失效' });
        }

        res.json({
            message: '登录验证成功',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('登录验证错误:', error);
        res.status(500).json({ error: '验证失败，请稍后重试' });
    }
});

// 获取用户资料
app.get('/api/auth/profile', authenticateToken, (req, res) => {
    try {
        const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json({
            message: '获取用户资料成功',
            user
        });
    } catch (error) {
        console.error('获取用户资料错误:', error);
        res.status(500).json({ error: '获取用户资料失败' });
    }
});

// 修改密码
app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: '旧密码和新密码都是必填项' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: '新密码长度至少为6位' });
    }

    try {
        // 获取当前用户信息
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 验证旧密码
        const isValidOldPassword = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isValidOldPassword) {
            return res.status(400).json({ error: '旧密码错误' });
        }

        // 加密新密码
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // 更新密码
        const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        const result = stmt.run(hashedNewPassword, req.user.id);

        if (result.changes === 0) {
            return res.status(500).json({ error: '密码更新失败' });
        }

        res.json({
            message: '密码修改成功'
        });

    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(500).json({ error: '密码修改失败，请稍后重试' });
    }
});

// 注销账号
app.delete('/api/auth/delete-account', authenticateToken, async (req, res) => {
    const { confirmPassword } = req.body;

    if (!confirmPassword) {
        return res.status(400).json({ error: '请输入密码确认注销' });
    }

    try {
        // 获取当前用户信息
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 验证密码
        const isValidPassword = await bcrypt.compare(confirmPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(400).json({ error: '密码错误' });
        }

        // 开始事务，确保级联删除的原子性
        const deleteSessions = db.prepare('DELETE FROM pomodoro_sessions WHERE user_id = ?');
        const deleteTodos = db.prepare('DELETE FROM todos WHERE user_id = ?');
        const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');

        // 执行级联删除
        deleteSessions.run(req.user.id);
        deleteTodos.run(req.user.id);
        const userResult = deleteUser.run(req.user.id);

        if (userResult.changes === 0) {
            return res.status(500).json({ error: '账号注销失败' });
        }

        res.json({
            message: '账号已成功注销，所有数据已被删除'
        });

    } catch (error) {
        console.error('注销账号错误:', error);
        res.status(500).json({ error: '账号注销失败，请稍后重试' });
    }
});

// === 聊天会话管理API ===

// 获取用户的所有会话
app.get('/api/chat/sessions', authenticateToken, (req, res) => {
    try {
        const sessions = db.prepare(`
            SELECT id, title, created_at, updated_at, is_active
            FROM chat_sessions
            WHERE user_id = ?
            ORDER BY updated_at DESC
        `).all(req.user.id);

        res.json({
            message: '获取会话列表成功',
            data: sessions
        });
    } catch (error) {
        console.error('获取会话列表错误:', error);
        res.status(500).json({ error: '获取会话列表失败' });
    }
});

// 创建新会话
app.post('/api/chat/sessions', authenticateToken, (req, res) => {
    try {
        // 先将其他会话设为非活跃
        db.prepare(`
            UPDATE chat_sessions
            SET is_active = FALSE
            WHERE user_id = ?
        `).run(req.user.id);

        // 创建新会话
        const result = db.prepare(`
            INSERT INTO chat_sessions (user_id, title, is_active)
            VALUES (?, '新建对话', TRUE)
        `).run(req.user.id);

        const newSession = db.prepare(`
            SELECT id, title, created_at, updated_at, is_active
            FROM chat_sessions
            WHERE id = ?
        `).get(result.lastInsertRowid);

        res.json({
            message: '创建会话成功',
            data: newSession
        });
    } catch (error) {
        console.error('创建会话错误:', error);
        res.status(500).json({ error: '创建会话失败' });
    }
});

// 更新会话（重命名）
app.put('/api/chat/sessions/:id', authenticateToken, (req, res) => {
    const sessionId = req.params.id;
    const { title } = req.body;

    if (!title || title.trim().length === 0) {
        return res.status(400).json({ error: '会话标题不能为空' });
    }

    try {
        // 验证会话属于当前用户
        const session = db.prepare(`
            SELECT id FROM chat_sessions
            WHERE id = ? AND user_id = ?
        `).get(sessionId, req.user.id);

        if (!session) {
            return res.status(404).json({ error: '会话不存在或无权限访问' });
        }

        // 更新会话标题和时间
        const result = db.prepare(`
            UPDATE chat_sessions
            SET title = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `).run(title.trim(), sessionId, req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: '会话不存在' });
        }

        res.json({
            message: '会话更新成功'
        });
    } catch (error) {
        console.error('更新会话错误:', error);
        res.status(500).json({ error: '更新会话失败' });
    }
});

// 删除会话
app.delete('/api/chat/sessions/:id', authenticateToken, (req, res) => {
    const sessionId = req.params.id;

    try {
        // 验证会话属于当前用户
        const session = db.prepare(`
            SELECT id FROM chat_sessions
            WHERE id = ? AND user_id = ?
        `).get(sessionId, req.user.id);

        if (!session) {
            return res.status(404).json({ error: '会话不存在或无权限访问' });
        }

        // 删除会话（级联删除会话消息）
        const result = db.prepare(`
            DELETE FROM chat_sessions
            WHERE id = ? AND user_id = ?
        `).run(sessionId, req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: '会话不存在' });
        }

        res.json({
            message: '会话删除成功'
        });
    } catch (error) {
        console.error('删除会话错误:', error);
        res.status(500).json({ error: '删除会话失败' });
    }
});

// 激活指定会话
app.put('/api/chat/sessions/:id/activate', authenticateToken, (req, res) => {
    const sessionId = req.params.id;

    try {
        // 验证会话属于当前用户
        const session = db.prepare(`
            SELECT id FROM chat_sessions
            WHERE id = ? AND user_id = ?
        `).get(sessionId, req.user.id);

        if (!session) {
            return res.status(404).json({ error: '会话不存在或无权限访问' });
        }

        // 先将所有会话设为非活跃
        db.prepare(`
            UPDATE chat_sessions
            SET is_active = FALSE
            WHERE user_id = ?
        `).run(req.user.id);

        // 激活指定会话
        db.prepare(`
            UPDATE chat_sessions
            SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `).run(sessionId, req.user.id);

        res.json({
            message: '会话激活成功'
        });
    } catch (error) {
        console.error('激活会话错误:', error);
        res.status(500).json({ error: '激活会话失败' });
    }
});

// 获取会话消息历史
app.get('/api/chat/messages/:sessionId', authenticateToken, (req, res) => {
    const sessionId = req.params.sessionId;

    try {
        // 验证会话属于当前用户
        const session = db.prepare(`
            SELECT id FROM chat_sessions
            WHERE id = ? AND user_id = ?
        `).get(sessionId, req.user.id);

        if (!session) {
            return res.status(404).json({ error: '会话不存在或无权限访问' });
        }

        // 获取消息历史
        const messages = db.prepare(`
            SELECT id, role, content, created_at
            FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
        `).all(sessionId);

        res.json({
            message: '获取消息历史成功',
            data: messages
        });
    } catch (error) {
        console.error('获取消息历史错误:', error);
        res.status(500).json({ error: '获取消息历史失败' });
    }
});

// 清理旧消息的辅助函数
function cleanupOldMessages(sessionId) {
    try {
        // 获取当前消息总数
        const totalCount = db.prepare(`
            SELECT COUNT(*) as count FROM chat_messages
            WHERE session_id = ?
        `).get(sessionId);

        if (totalCount.count <= 20) return; // 不需要清理

        // 找到最早的完整对话轮次（用户消息 + AI回复）
        const oldestMessages = db.prepare(`
            SELECT id, role FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
            LIMIT 2
        `).all(sessionId);

        // 如果最早的两条消息是用户+AI的组合，就删除它们
        if (oldestMessages.length === 2 &&
            oldestMessages[0].role === 'user' &&
            oldestMessages[1].role === 'assistant') {

            db.prepare(`
                DELETE FROM chat_messages
                WHERE id IN (?, ?)
            `).run(oldestMessages[0].id, oldestMessages[1].id);

            console.log(`清理了会话 ${sessionId} 的最早对话轮次`);
        }
    } catch (error) {
        console.error('清理旧消息错误:', error);
    }
}

// 生成会话标题的辅助函数
function generateSessionTitle(firstMessage) {
    if (!firstMessage) return "新建对话";

    // 去除前后空格，取前10个字符
    const title = firstMessage.trim().substring(0, 10);
    return title || "新建对话";
}

// 发送聊天消息（支持会话管理）
app.post('/api/chat/send', authenticateToken, async (req, res) => {
    const { message, sessionId } = req.body;

    if (!message) {
        return res.status(400).json({ error: '消息内容不能为空' });
    }

    if (!sessionId) {
        return res.status(400).json({ error: '会话ID不能为空' });
    }

    try {
        // 验证会话属于当前用户
        const session = db.prepare(`
            SELECT id, title FROM chat_sessions
            WHERE id = ? AND user_id = ?
        `).get(sessionId, req.user.id);

        if (!session) {
            return res.status(404).json({ error: '会话不存在或无权限访问' });
        }

        // 检查是否是该会话的第一条用户消息
        const messageCount = db.prepare(`
            SELECT COUNT(*) as count FROM chat_messages
            WHERE session_id = ? AND role = 'user'
        `).get(sessionId);

        const isFirstMessage = messageCount.count === 0;

        // 如果是第一条消息，更新会话标题
        if (isFirstMessage && session.title === '新建对话') {
            const newTitle = generateSessionTitle(message);
            db.prepare(`
                UPDATE chat_sessions
                SET title = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(newTitle, sessionId);
        }

        // 保存用户消息
        db.prepare(`
            INSERT INTO chat_messages (session_id, role, content)
            VALUES (?, 'user', ?)
        `).run(sessionId, message);

        // 获取会话上下文（所有消息）
        const contextMessages = db.prepare(`
            SELECT role, content FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
        `).all(sessionId);

        // 准备AI API请求
        const apiKey = process.env.ZHIPU_API_KEY;

        if (!apiKey) {
            // 保存系统回复
            db.prepare(`
                INSERT INTO chat_messages (session_id, role, content)
                VALUES (?, 'assistant', ?)
            `).run(sessionId, "智谱AI服务未配置。");

            return res.json({
                success: false,
                reply: "智谱AI服务未配置。",
                timestamp: new Date().toLocaleTimeString()
            });
        }

        // 构建消息历史
        const messages = [
            {
                role: "system",
                content: "请用清晰的方式回答问题，适当使用段落和换行，让内容易于阅读。"
            }
        ];

        // 添加上下文消息
        contextMessages.forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        });

        const requestBody = {
            model: "glm-4-flash",
            messages: messages,
            max_tokens: 1500,
            temperature: 0.7,
            stream: false
        };

        console.log(`发送AI请求，会话 ${sessionId}，消息数: ${contextMessages.length}`);

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

            // 保存错误回复
            db.prepare(`
                INSERT INTO chat_messages (session_id, role, content)
                VALUES (?, 'assistant', ?)
            `).run(sessionId, "AI服务暂时不可用，请稍后重试。");

            throw new Error(`智谱AI API错误 ${response.status}`);
        }

        const data = await response.json();
        console.log('智谱AI API响应成功');

        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            let aiReply = data.choices[0].message.content;

            // 格式化回复内容
            aiReply = simpleFormatAIResponse(aiReply);

            // 保存AI回复
            db.prepare(`
                INSERT INTO chat_messages (session_id, role, content)
                VALUES (?, 'assistant', ?)
            `).run(sessionId, aiReply);

            // 清理旧消息（如果需要）
            cleanupOldMessages(sessionId);

            // 更新会话时间
            db.prepare(`
                UPDATE chat_sessions
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(sessionId);

            res.json({
                success: true,
                reply: aiReply,
                timestamp: new Date().toLocaleTimeString(),
                model: "glm-4-flash"
            });
        } else {
            // 保存错误回复
            db.prepare(`
                INSERT INTO chat_messages (session_id, role, content)
                VALUES (?, 'assistant', ?)
            `).run(sessionId, "AI返回数据异常，请重试。");

            throw new Error('智谱AI返回数据格式异常');
        }

    } catch (error) {
        console.error('AI聊天错误:', error.message);

        let errorMessage = "AI服务暂时不可用，请稍后重试。";
        if (error.name === 'AbortError') {
            errorMessage = "请求超时，请稍后重试。";
        }

        // 如果还没有保存错误回复，尝试保存
        try {
            if (sessionId) {
                db.prepare(`
                    INSERT INTO chat_messages (session_id, role, content)
                    VALUES (?, 'assistant', ?)
                `).run(sessionId, errorMessage);
            }
        } catch (dbError) {
            console.error('保存错误回复失败:', dbError);
        }

        res.json({
            success: false,
            reply: errorMessage,
            timestamp: new Date().toLocaleTimeString()
        });
    }
});

// === 兼容旧版AI学习伙伴API（不推荐使用）===
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: '消息内容不能为空' });
    }

    console.log('收到旧版AI聊天请求（无会话管理）:', message);

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

// 5. 获取当前用户的待办事项
app.get('/api/todos', authenticateToken, (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY completed, created_at DESC');
        const rows = stmt.all(req.user.id);

        res.json({
            message: '成功获取待办事项',
            data: rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. 添加新的待办事项
app.post('/api/todos', authenticateToken, (req, res) => {
    const { text, duration, completed = false } = req.body;

    if (!text || !duration) {
        return res.status(400).json({ error: '事项内容和时长是必填项' });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO todos (user_id, text, duration, completed)
            VALUES (?, ?, ?, ?)
        `);

        const result = stmt.run(req.user.id, text, duration, completed ? 1 : 0);

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
app.put('/api/todos/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const { completed, text, duration } = req.body;

    try {
        // 首先验证待办事项属于当前用户
        const todoCheck = db.prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!todoCheck) {
            return res.status(404).json({ error: '待办事项不存在或无权限访问' });
        }

        let stmt, result;

        if (typeof completed !== 'undefined') {
            stmt = db.prepare('UPDATE todos SET completed = ? WHERE id = ? AND user_id = ?');
            result = stmt.run(completed ? 1 : 0, id, req.user.id);
        } else if (text && duration) {
            stmt = db.prepare('UPDATE todos SET text = ?, duration = ? WHERE id = ? AND user_id = ?');
            result = stmt.run(text, duration, id, req.user.id);
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
app.delete('/api/todos/:id', authenticateToken, (req, res) => {
    const id = req.params.id;

    try {
        // 首先验证待办事项属于当前用户
        const todoCheck = db.prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!todoCheck) {
            return res.status(404).json({ error: '待办事项不存在或无权限访问' });
        }

        const stmt = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?');
        const result = stmt.run(id, req.user.id);

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
