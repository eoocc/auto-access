# 自动访问系统

一个基于Node.js的自动化网站访问系统，支持24小时访问和定时访问模式。

## 功能特性

- 🔐 用户认证系统
- 🌐 支持单个和批量添加URL
- ⏰ 两种访问模式：24小时访问和定时访问（1:00-6:00暂停）
- 📊 实时访问日志和统计
- 🔔 Telegram错误提醒（可选）
- 📱 响应式Web界面

## 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 启动服务器：
```bash
npm start
```

3. 访问系统：
   - 地址：http://localhost:3000
   - 默认用户名：admin
   - 默认密码：admin123

## 环境变量配置

### 基础配置
- `SERVER_PORT`: 服务器端口（默认：3000）
- `ADMIN_USERNAME`: 管理员用户名（默认：admin）
- `ADMIN_PASSWORD`: 管理员密码（默认：admin123）

### Telegram提醒配置

要启用Telegram错误提醒，需要同时设置以下两个环境变量：

#### 1. 获取Bot Token
1. 在Telegram中搜索 `@BotFather`
2. 发送 `/newbot` 命令
3. 按提示设置机器人名称
4. 创建成功后，BotFather会发送给你一个token

#### 2. 获取Chat ID
1. 将机器人添加到群组或私聊
2. 在群组中发送一条消息
3. 访问：`https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`
4. 在返回的JSON中找到 `chat.id` 字段

#### 3. 设置环境变量
```bash
# Linux/Mac
export TG_BOT_TOKEN="your_bot_token_here"
export TG_CHAT_ID="your_chat_id_here"

# Windows
set TG_BOT_TOKEN=your_bot_token_here
set TG_CHAT_ID=your_chat_id_here

# 或者在 .env 文件中设置
TG_BOT_TOKEN=your_bot_token_here
TG_CHAT_ID=your_chat_id_here
```

#### 4. 重启服务器
设置环境变量后，重启服务器即可生效。

## 使用说明

### 添加URL
- **单个添加**：输入URL、选择访问模式、添加备注
- **批量添加**：每行一个URL，格式：`URL|备注(可选)`

### 访问模式
- **24小时访问**：每2分钟访问一次，全天不间断
- **定时访问**：每2分钟访问一次，但凌晨1:00-6:00暂停

### 错误提醒
当URL访问出错时，如果配置了Telegram，系统会自动发送包含以下信息的提醒：
- 🚨 错误类型标识
- 🔗 出错的URL
- 📊 访问模式
- ❌ 错误状态码
- 💬 详细错误信息
- ⏰ 发生时间

## 注意事项

1. 确保目标网站允许自动化访问
2. 建议设置合理的访问间隔，避免对目标服务器造成压力
3. Telegram提醒需要网络能够访问Telegram API
4. 系统会自动保存访问日志，定期清理72小时前的数据

## 技术架构

- **后端**：Node.js + Express
- **前端**：原生JavaScript + HTML + CSS
- **定时任务**：node-cron
- **时间处理**：moment-timezone
- **HTTP客户端**：axios
- **数据存储**：JSON文件
