const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'pomodoro.db');
const db = new Database(dbPath);

// 查看表结构
console.log('=== 表结构 ===');
const tableInfo = db.prepare("PRAGMA table_info(pomodoro_sessions)").all();
console.table(tableInfo);

// 查看数据
console.log('=== 数据记录 ===');
const sessions = db.prepare("SELECT * FROM pomodoro_sessions ORDER BY completed_at DESC").all();
console.table(sessions);

db.close();