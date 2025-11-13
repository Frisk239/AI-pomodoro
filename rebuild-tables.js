const Database = require('better-sqlite3');
const path = require('path');

// 创建数据库连接
const dbPath = path.join(__dirname, 'pomodoro.db');
const db = new Database(dbPath);

console.log('开始重建数据库表...');

// 删除可能存在的旧表
try {
    db.exec('DROP TABLE IF EXISTS pomodoro_sessions');
    console.log('已删除旧的 pomodoro_sessions 表');
} catch (error) {
    console.log('删除表时出错:', error.message);
}

// 删除可能存在的旧表
try {
    db.exec('DROP TABLE IF EXISTS todos');
    console.log('已删除旧的 todos 表');
} catch (error) {
    console.log('删除表时出错:', error.message);
}

// 删除可能存在的旧表
try {
    db.exec('DROP TABLE IF EXISTS chat_sessions');
    console.log('已删除旧的 chat_sessions 表');
} catch (error) {
    console.log('删除表时出错:', error.message);
}

// 删除可能存在的旧表
try {
    db.exec('DROP TABLE IF EXISTS chat_messages');
    console.log('已删除旧的 chat_messages 表');
} catch (error) {
    console.log('删除表时出错:', error.message);
}

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

db.exec(createUsersTableSQL);
console.log('已创建 users 表');

// 创建番茄钟记录表（包含user_id）
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

db.exec(createSessionsTableSQL);
console.log('已创建 pomodoro_sessions 表（包含user_id）');

// 创建待办事项表（包含user_id）
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

db.exec(createTodosTableSQL);
console.log('已创建 todos 表（包含user_id）');

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

db.exec(createChatSessionsTableSQL);
console.log('已创建 chat_sessions 表');

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

db.exec(createChatMessagesTableSQL);
console.log('已创建 chat_messages 表');

console.log('数据库表重建完成！');

// 验证表结构
console.log('\n验证表结构:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('现有表:', tables.map(t => t.name));

console.log('\npomodoro_sessions 表结构:');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pomodoro_sessions'").get();
console.log(schema.sql);

db.close();
console.log('\n数据库连接已关闭。');
