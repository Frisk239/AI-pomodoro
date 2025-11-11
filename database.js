const Database = require('better-sqlite3');
const path = require('path');

// 创建数据库连接
const dbPath = path.join(__dirname, 'pomodoro.db');
const db = new Database(dbPath);

// 初始化数据库表
function initDatabase() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS pomodoro_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL,
            duration INTEGER NOT NULL,
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            session_type TEXT DEFAULT 'work'
        )
    `;
    
    db.exec(createTableSQL);
    console.log('数据表准备就绪');
}

initDatabase();
module.exports = db;