const axios = require('axios');
const moment = require('moment-timezone');
const cron = require('node-cron');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const session = require('express-session');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const port = process.env.SERVER_PORT || process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// 默认密码配置
const USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const URLS_FILE = path.join(DATA_DIR, 'urls.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 存储URL和日志的数据结构
let urls = [];
let scheduledUrls = [];
let accessLogs = [];

// 加载数据函数
function loadData() {
  try {
    // 加载URLs数据
    if (fs.existsSync(URLS_FILE)) {
      const urlData = JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));
      urls = urlData.urls || [];
      scheduledUrls = urlData.scheduledUrls || [];
      console.log(`加载了 ${urls.length} 个24小时URL和 ${scheduledUrls.length} 个定时URL`);
    } else {
      // 创建默认数据
      urls = [
        { id: 1, url: 'https://www.baidu.com', name: '百度', type: '24h', active: true },
        { id: 2, url: 'https://www.yahoo.com', name: '雅虎', type: '24h', active: true }
      ];
      scheduledUrls = [
        { id: 3, url: 'https://www.google.com', name: '谷歌', type: 'scheduled', active: true }
      ];
      saveUrlsData();
    }
    
    // 加载日志数据
    if (fs.existsSync(LOGS_FILE)) {
      const logData = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
      accessLogs = logData.logs || [];
      console.log(`加载了 ${accessLogs.length} 条访问日志`);
    }
  } catch (error) {
    console.error('加载数据失败:', error.message);
    // 使用默认数据
    urls = [
      { id: 1, url: 'https://www.baidu.com', name: '百度', type: '24h', active: true },
      { id: 2, url: 'https://www.yahoo.com', name: '雅虎', type: '24h', active: true }
    ];
    scheduledUrls = [
      { id: 3, url: 'https://www.google.com', name: '谷歌', type: 'scheduled', active: true }
    ];
    accessLogs = [];
  }
}

// 保存URLs数据
function saveUrlsData() {
  try {
    const data = {
      urls: urls,
      scheduledUrls: scheduledUrls,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(URLS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    // 静默处理错误
  }
}

// 保存日志数据
function saveLogsData() {
  try {
    const data = {
      logs: accessLogs,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(LOGS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    // 静默处理错误
  }
}

// 清理过期日志数据（72小时前的数据）
function cleanupOldLogs() {
  try {
    const cutoffTime = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72小时前
    const originalLength = accessLogs.length;
    
    accessLogs = accessLogs.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime > cutoffTime;
    });
    
    if (originalLength !== accessLogs.length) {
      saveLogsData(); // 保存清理后的日志
    }
  } catch (error) {
    // 静默处理错误
  }
}

// 启动时加载数据
loadData();

// 访问日志记录函数
function logAccess(url, status, type, error = null) {
  const log = {
    id: Date.now(),
    url: url,
    status: status,
    type: type,
    timestamp: moment().tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'),
    error: error
  };
  accessLogs.unshift(log);
  
  // 只保留最近1000条日志
  if (accessLogs.length > 1000) {
    accessLogs = accessLogs.slice(0, 1000);
  }
  
  // 保存日志到文件（但不要每次都保存，改为定时保存）
  // saveLogsData();
}

// 定时保存日志数据（每5分钟保存一次）
setInterval(() => {
  if (accessLogs.length > 0) {
    saveLogsData();
  }
}, 5 * 60 * 1000);

// 定时清理过期日志（每天凌晨2点执行）
cron.schedule('0 2 * * *', () => {
  cleanupOldLogs();
});

// 忽略SSL证书验证
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// 访问网站函数
async function visitWebsite(url, type) {
  try {
    const response = await axios.get(url, { httpsAgent });
    logAccess(url, response.status, type);
  } catch (error) {
    let errorStatus;
    if (error.response) {
      errorStatus = error.response.status;
    } else {
      errorStatus = error.code;
    }
    logAccess(url, errorStatus, type, error.message);
  }
}

// 24小时不间断访问
cron.schedule('*/2 * * * *', () => {
  urls.filter(u => u.active).forEach((urlObj) => {
    visitWebsite(urlObj.url, '24h');
  });
});

// 定时访问（01:00-05:00暂停）
function checkAndSetTimer() {
  const currentMoment = moment().tz('Asia/Hong_Kong');
  if (currentMoment.hours() >= 1 && currentMoment.hours() < 5) {
    clearInterval(visitIntervalId);
    const nextVisitTime = currentMoment.add(0, 'day').hours(5).minutes(0).seconds(0);
    const nextVisitInterval = nextVisitTime.diff(currentMoment);
    setTimeout(() => {
      startScheduledVisits();
    }, nextVisitInterval);
  } else {
    startScheduledVisits();
  }
}

let visitIntervalId;
function startScheduledVisits() {
  clearInterval(visitIntervalId);
  visitIntervalId = setInterval(() => {
    scheduledUrls.filter(u => u.active).forEach((urlObj) => {
      visitWebsite(urlObj.url, 'scheduled');
    });
  }, 2 * 60 * 1000); // 每2分钟执行一次
}

// 启动定时访问
checkAndSetTimer();
setInterval(checkAndSetTimer, 2 * 60 * 1000);

// 身份验证中间件
function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: '未授权访问' });
  }
}

// 登录API
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === USERNAME && password === PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true, message: '登录成功' });
  } else {
    res.status(401).json({ error: '用户名或密码错误' });
  }
});

// 登出API
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: '登出成功' });
});

// 获取URL列表
app.get('/api/urls', requireAuth, (req, res) => {
  res.json({
    urls: urls,
    scheduledUrls: scheduledUrls
  });
});

// 添加URL
app.post('/api/urls', requireAuth, (req, res) => {
  const { url, name, type } = req.body;
  
  if (!url || !name || !type) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const newUrl = {
    id: Date.now(),
    url: url,
    name: name,
    type: type,
    active: true
  };
  
  if (type === '24h') {
    urls.push(newUrl);
  } else if (type === 'scheduled') {
    scheduledUrls.push(newUrl);
  }
  
  // 保存数据到文件
  saveUrlsData();
  
  res.json({ success: true, url: newUrl });
});

// 删除URL
app.delete('/api/urls/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  
  urls = urls.filter(u => u.id !== id);
  scheduledUrls = scheduledUrls.filter(u => u.id !== id);
  
  // 保存数据到文件
  saveUrlsData();
  
  res.json({ success: true });
});

// 更新URL状态
app.put('/api/urls/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const { active } = req.body;
  
  let url = urls.find(u => u.id === id);
  if (url) {
    url.active = active;
  } else {
    url = scheduledUrls.find(u => u.id === id);
    if (url) {
      url.active = active;
    }
  }
  
  if (url) {
    // 保存数据到文件
    saveUrlsData();
    res.json({ success: true, url: url });
  } else {
    res.status(404).json({ error: 'URL不存在' });
  }
});

// 获取访问日志
app.get('/api/logs', requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const start = (page - 1) * limit;
  const end = start + limit;
  
  res.json({
    logs: accessLogs.slice(start, end),
    total: accessLogs.length,
    page: page,
    limit: limit
  });
});

// 清空日志
app.delete('/api/logs', requireAuth, (req, res) => {
  accessLogs = [];
  // 保存数据到文件
  saveLogsData();
  res.json({ success: true, message: '日志已清空' });
});

// 前端页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 程序关闭时保存数据
process.on('SIGINT', () => {
  saveUrlsData();
  saveLogsData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveUrlsData();
  saveLogsData();
  process.exit(0);
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在端口: ${port}`);
  console.log(`前端页面: http://localhost:${port}`);
  console.log(`数据存储位置: ${DATA_DIR}`);
  console.log(`username/password: ${USERNAME}/${PASSWORD}`);
});
