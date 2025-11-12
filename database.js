const Database = require('better-sqlite3');
const path = require('path');

// 创建数据库连接
const dbPath = path.join(__dirname, 'pomodoro.db');
const db = new Database(dbPath);

// 初始化数据库表
function initDatabase() {
    // 创建用户表
    const createUsersTableSQL = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;

    // 创建番茄钟记录表（添加user_id字段）
    const createSessionsTableSQL = `
        CREATE TABLE IF NOT EXISTS pomodoro_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_name TEXT NOT NULL,
            duration INTEGER NOT NULL,
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            session_type TEXT DEFAULT 'work',
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `;

    // 创建待办事项表（添加user_id字段）
    const createTodosTableSQL = `
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            duration INTEGER NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `;

    // 创建聊天会话表
    const createChatSessionsTableSQL = `
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL DEFAULT '新建对话',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `;

    // 创建聊天消息表
    const createChatMessagesTableSQL = `
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
        )
    `;

    db.exec(createUsersTableSQL);
    db.exec(createSessionsTableSQL);
    db.exec(createTodosTableSQL);
    db.exec(createChatSessionsTableSQL);
    db.exec(createChatMessagesTableSQL);

    console.log('数据库表准备就绪');
}

initDatabase();
module.exports = db;
