// API工具类
class ApiClient {
    constructor() {
        this.baseUrl = window.location.origin;
    }

    async request(url, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            credentials: 'same-origin',
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(`${this.baseUrl}${url}`, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '请求失败');
            }

            return data;
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    }

    // 认证相关
    async login(username, password) {
        return this.request('/api/login', {
            method: 'POST',
            body: { username, password }
        });
    }

    async logout() {
        return this.request('/api/logout', {
            method: 'POST'
        });
    }

    // URL管理
    async getUrls() {
        return this.request('/api/urls');
    }

    async addUrl(url, name, type) {
        return this.request('/api/urls', {
            method: 'POST',
            body: { url, name, type }
        });
    }

    async deleteUrl(id) {
        return this.request(`/api/urls/${id}`, {
            method: 'DELETE'
        });
    }

    async updateUrl(id, active) {
        return this.request(`/api/urls/${id}`, {
            method: 'PUT',
            body: { active }
        });
    }

    // 日志管理
    async getLogs(page = 1, limit = 50) {
        return this.request(`/api/logs?page=${page}&limit=${limit}`);
    }

    async clearLogs() {
        return this.request('/api/logs', {
            method: 'DELETE'
        });
    }
}

// 应用状态管理
class AppState {
    constructor() {
        this.isAuthenticated = false;
        this.urls24h = [];
        this.urlsScheduled = [];
        this.logs = [];
        this.currentTab = 'urls';
        this.api = new ApiClient();
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthentication();
    }

    bindEvents() {
        // 登录相关
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        // 标签页切换
        const navItems = document.querySelectorAll('.nav-item[data-tab]');
        navItems.forEach(item => {
            item.addEventListener('click', this.handleTabSwitch.bind(this));
        });

        // URL管理相关
        const addUrlBtn = document.getElementById('addUrlBtn');
        if (addUrlBtn) {
            addUrlBtn.addEventListener('click', this.showAddUrlForm.bind(this));
        }

        const cancelAddBtn = document.getElementById('cancelAddBtn');
        if (cancelAddBtn) {
            cancelAddBtn.addEventListener('click', this.hideAddUrlForm.bind(this));
        }

        const urlForm = document.getElementById('urlForm');
        if (urlForm) {
            urlForm.addEventListener('submit', this.handleUrlSubmit.bind(this));
        }

        // 日志相关
        const refreshLogsBtn = document.getElementById('refreshLogsBtn');
        if (refreshLogsBtn) {
            refreshLogsBtn.addEventListener('click', this.refreshLogs.bind(this));
        }

        const clearLogsBtn = document.getElementById('clearLogsBtn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', this.clearLogs.bind(this));
        }

        // 日志过滤器
        const dateFilter = document.getElementById('dateFilter');
        const statusFilter = document.getElementById('statusFilter');
        const urlFilter = document.getElementById('urlFilter');

        if (dateFilter) dateFilter.addEventListener('change', this.filterLogs.bind(this));
        if (statusFilter) statusFilter.addEventListener('change', this.filterLogs.bind(this));
        if (urlFilter) urlFilter.addEventListener('input', this.debounce(this.filterLogs.bind(this), 300));

        // 模态框相关
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) {
            const closeBtn = confirmModal.querySelector('.modal-close');
            const cancelBtn = document.getElementById('confirmCancel');
            
            if (closeBtn) closeBtn.addEventListener('click', this.hideConfirmModal.bind(this));
            if (cancelBtn) cancelBtn.addEventListener('click', this.hideConfirmModal.bind(this));
            
            confirmModal.addEventListener('click', (e) => {
                if (e.target === confirmModal) {
                    this.hideConfirmModal();
                }
            });
        }
    }

    checkAuthentication() {
        // 通过尝试获取URL列表来验证用户是否已登录
        this.loadData().then(() => {
            this.isAuthenticated = true;
            this.showMainPage();
        }).catch(() => {
            this.isAuthenticated = false;
            this.showLoginPage();
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const errorDiv = document.getElementById('loginError');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // 显示加载状态
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';
        submitBtn.disabled = true;
        
        try {
            await this.api.login(usernameInput.value, passwordInput.value);
            this.isAuthenticated = true;
            await this.showMainPage();
            passwordInput.value = '';
            errorDiv.classList.remove('show');
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.add('show');
            passwordInput.value = '';
            passwordInput.focus();
        } finally {
            // 恢复按钮状态
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
            submitBtn.disabled = false;
        }
    }

    async handleLogout() {
        try {
            await this.api.logout();
        } catch (error) {
            console.error('登出错误:', error);
        }
        
        this.isAuthenticated = false;
        this.showLoginPage();
    }

    showLoginPage() {
        document.getElementById('loginPage').classList.add('active');
        document.getElementById('mainPage').classList.remove('active');
        document.getElementById('username').focus();
    }

    async showMainPage() {
        document.getElementById('loginPage').classList.remove('active');
        document.getElementById('mainPage').classList.add('active');
        await this.loadData();
    }

    async loadData() {
        try {
            console.log('正在加载数据...');
            
            // 加载URL数据
            const urlData = await this.api.getUrls();
            console.log('从后端获取的URL数据:', urlData);
            
            this.urls24h = urlData.urls || [];
            this.urlsScheduled = urlData.scheduledUrls || [];
            
            console.log('24小时URLs:', this.urls24h);
            console.log('定时URLs:', this.urlsScheduled);
            
            // 加载日志数据
            const logData = await this.api.getLogs();
            console.log('从后端获取的日志数据:', logData);
            
            this.logs = logData.logs || [];
            
            this.renderUrls();
            this.renderLogs();
            this.updateStats();
            
            console.log('数据加载完成');
        } catch (error) {
            console.error('加载数据失败:', error);
            throw error;
        }
    }

    handleTabSwitch(e) {
        const tabName = e.currentTarget.dataset.tab;
        
        // 更新导航状态
        document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
            item.classList.remove('active');
        });
        e.currentTarget.classList.add('active');

        // 切换标签页内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        this.currentTab = tabName;
        
        // 如果切换到日志页面，刷新日志
        if (tabName === 'logs') {
            this.refreshLogs();
        }
    }

    showAddUrlForm() {
        document.getElementById('addUrlForm').style.display = 'block';
        document.getElementById('urlInput').focus();
    }

    hideAddUrlForm() {
        document.getElementById('addUrlForm').style.display = 'none';
        document.getElementById('urlForm').reset();
        document.getElementById('enabledInput').checked = true;
    }

    async handleUrlSubmit(e) {
        e.preventDefault();
        
        const urlInput = document.getElementById('urlInput');
        const intervalInput = document.getElementById('intervalInput');
        const descriptionInput = document.getElementById('descriptionInput');
        const enabledInput = document.getElementById('enabledInput');
        const submitBtn = e.target.querySelector('button[type="submit"]');

        // 显示加载状态
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        submitBtn.disabled = true;

        try {
            // 根据间隔确定类型
            const type = parseInt(intervalInput.value) >= 60 ? '24h' : 'scheduled';
            
            console.log('提交URL数据:', {
                url: urlInput.value.trim(),
                name: descriptionInput.value.trim() || 'URL',
                type: type
            });
            
            await this.api.addUrl(
                urlInput.value.trim(), 
                descriptionInput.value.trim() || 'URL', 
                type
            );
            
            await this.loadData(); // 重新加载数据
            this.hideAddUrlForm();
            this.showNotification('success', 'URL添加成功');
        } catch (error) {
            console.error('添加URL失败:', error);
            this.showNotification('error', '添加失败: ' + error.message);
        } finally {
            // 恢复按钮状态
            submitBtn.innerHTML = '<i class="fas fa-save"></i> 保存';
            submitBtn.disabled = false;
        }
    }

    async deleteUrl(id) {
        this.showConfirmModal(
            '删除URL',
            '确定要删除这个URL吗？此操作不可撤销。',
            async () => {
                try {
                    console.log('删除URL ID:', id);
                    await this.api.deleteUrl(id);
                    await this.loadData(); // 重新加载数据
                    this.showNotification('success', 'URL删除成功');
                } catch (error) {
                    console.error('删除URL失败:', error);
                    this.showNotification('error', '删除失败: ' + error.message);
                }
            }
        );
    }

    async toggleUrl(id) {
        try {
            console.log('切换URL状态, ID:', id);
            
            // 找到要切换的URL
            let url = this.urls24h.find(u => u.id == id);
            if (!url) {
                url = this.urlsScheduled.find(u => u.id == id);
            }
            
            if (url) {
                console.log('当前URL状态:', url.active, '切换为:', !url.active);
                await this.api.updateUrl(id, !url.active);
                await this.loadData(); // 重新加载数据
                this.showNotification('success', `URL已${!url.active ? '启用' : '禁用'}`);
            } else {
                console.error('未找到URL:', id);
                this.showNotification('error', '未找到指定的URL');
            }
        } catch (error) {
            console.error('切换URL状态失败:', error);
            this.showNotification('error', '操作失败: ' + error.message);
        }
    }

    renderUrls() {
        const container = document.getElementById('urlsList');
        const allUrls = [...this.urls24h, ...this.urlsScheduled];
        
        console.log('渲染URLs:', allUrls);
        
        if (allUrls.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-link"></i>
                    <h3>暂无URL</h3>
                    <p>点击"添加URL"按钮开始添加要监控的URL</p>
                </div>
            `;
            return;
        }

        container.innerHTML = allUrls.map(url => `
            <div class="url-item fade-in">
                <div class="url-header">
                    <div class="url-info">
                        <h4>${url.url}</h4>
                        <p>${url.name || '无描述'}</p>
                    </div>
                    <div class="url-details compact">
                        <div class="detail-item">
                            <span class="detail-label">状态</span>
                            <span class="detail-value">
                                <span class="status-badge ${url.active ? 'status-active' : 'status-inactive'}">
                                    <i class="fas fa-${url.active ? 'play' : 'pause'}"></i>
                                    ${url.active ? '活跃' : '暂停'}
                                </span>
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">ID</span>
                            <span class="detail-value">#${url.id}</span>
                        </div>
                    </div>
                    <div class="url-actions">
                        <button class="btn ${url.active ? 'btn-danger' : 'btn-success'}" 
                                onclick="app.toggleUrl(${url.id})" 
                                title="${url.active ? '禁用' : '启用'}">
                            <i class="fas fa-${url.active ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="btn btn-danger" onclick="app.deleteUrl(${url.id})" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async refreshLogs() {
        const refreshBtn = document.getElementById('refreshLogsBtn');
        const originalText = refreshBtn.innerHTML;
        
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 刷新中...';
        refreshBtn.disabled = true;
        
        try {
            const logData = await this.api.getLogs();
            this.logs = logData.logs || [];
            this.renderLogs();
            this.showNotification('success', '日志已刷新');
        } catch (error) {
            console.error('刷新日志失败:', error);
            this.showNotification('error', '刷新失败: ' + error.message);
        } finally {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }
    }

    async clearLogs() {
        this.showConfirmModal(
            '清空日志',
            '确定要清空所有日志记录吗？此操作不可撤销。',
            async () => {
                try {
                    await this.api.clearLogs();
                    this.logs = [];
                    this.renderLogs();
                    this.updateStats();
                    this.showNotification('success', '日志已清空');
                } catch (error) {
                    console.error('清空日志失败:', error);
                    this.showNotification('error', '清空失败: ' + error.message);
                }
            }
        );
    }

    filterLogs() {
        const dateFilter = document.getElementById('dateFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const urlFilter = document.getElementById('urlFilter').value.toLowerCase();

        let filteredLogs = this.logs;

        if (dateFilter) {
            filteredLogs = filteredLogs.filter(log => {
                const logDate = log.timestamp.split(' ')[0];
                return logDate === dateFilter;
            });
        }

        if (statusFilter) {
            filteredLogs = filteredLogs.filter(log => {
                if (statusFilter === 'success') {
                    return log.status !== 'ERROR' && typeof log.status === 'number' && log.status >= 200 && log.status < 300;
                } else if (statusFilter === 'error') {
                    return log.status === 'ERROR' || (typeof log.status === 'number' && log.status >= 400);
                }
                return true;
            });
        }

        if (urlFilter) {
            filteredLogs = filteredLogs.filter(log => 
                log.url.toLowerCase().includes(urlFilter)
            );
        }

        this.renderFilteredLogs(filteredLogs);
    }

    renderLogs() {
        this.renderFilteredLogs(this.logs);
    }

    renderFilteredLogs(logs) {
        const container = document.getElementById('logsList');
        
        if (logs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>暂无日志记录</h3>
                    <p>系统开始运行后会在这里显示访问日志</p>
                </div>
            `;
            return;
        }

        // 按时间戳排序（最新的在前）
        const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        container.innerHTML = sortedLogs.map(log => {
            // 确保状态码正确显示
            let statusCode;
            if (typeof log.status === 'number') {
                statusCode = log.status.toString();
            } else if (typeof log.status === 'string') {
                // 处理各种错误状态
                if (log.status === 'ENOTFOUND') {
                    statusCode = 'DNS错误';
                } else if (log.status === 'ECONNREFUSED') {
                    statusCode = '连接拒绝';
                } else if (log.status === 'ETIMEDOUT') {
                    statusCode = '超时';
                } else if (log.status === 'EAI_AGAIN') {
                    statusCode = 'DNS临时错误';
                } else if (log.status === 'ENETUNREACH') {
                    statusCode = '网络不可达';
                } else if (log.status === 'EHOSTUNREACH') {
                    statusCode = '主机不可达';
                } else if (log.status === 'ECONNRESET') {
                    statusCode = '连接重置';
                } else if (log.status === 'EPIPE') {
                    statusCode = '管道破裂';
                } else if (log.status === 'ECANCELED') {
                    statusCode = '请求取消';
                } else if (log.status.match(/^\d{3}$/)) {
                    // 如果是3位数字的状态码
                    statusCode = log.status;
                } else {
                    statusCode = log.status;
                }
            } else {
                statusCode = 'N/A';
            }
            
            // 根据状态码确定状态消息
            let statusMessage;
            if (log.status === 'ENOTFOUND' || log.status === 'ECONNREFUSED' || log.status === 'ETIMEDOUT' || 
                log.status === 'EAI_AGAIN' || log.status === 'ENETUNREACH' || log.status === 'EHOSTUNREACH' ||
                log.status === 'ECONNRESET' || log.status === 'EPIPE' || log.status === 'ECANCELED') {
                statusMessage = '网络错误';
            } else if (typeof log.status === 'number') {
                if (log.status >= 200 && log.status < 300) {
                    statusMessage = '请求成功';
                } else if (log.status >= 400 && log.status < 500) {
                    statusMessage = '客户端错误';
                } else if (log.status >= 500) {
                    statusMessage = '服务器错误';
                } else {
                    statusMessage = '请求失败';
                }
            } else if (typeof log.status === 'string' && log.status.match(/^\d{3}$/)) {
                const numStatus = parseInt(log.status);
                if (numStatus >= 200 && numStatus < 300) {
                    statusMessage = '请求成功';
                } else if (numStatus >= 400 && numStatus < 500) {
                    statusMessage = '客户端错误';
                } else if (numStatus >= 500) {
                    statusMessage = '服务器错误';
                } else {
                    statusMessage = '请求失败';
                }
            } else {
                statusMessage = '请求失败';
            }
            
            const typeInfo = log.type || 'N/A';
            
            return `
                <div class="log-item fade-in">
                    <div class="log-header">
                        <div class="log-url">${log.url}</div>
                        <div class="log-details">
                            <span class="log-status-code ${this.getLogStatusClass(log.status)}">
                                ${statusCode}
                            </span>
                            <span class="log-message">${statusMessage}</span>
                            <span class="log-response-time">类型: ${typeInfo}</span>
                        </div>
                        <div class="log-time">${log.timestamp}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateStats() {
        const allUrls = [...this.urls24h, ...this.urlsScheduled];
        const totalUrls = allUrls.length;
        const activeUrls = allUrls.filter(url => url.active).length;
        const totalRequests = this.logs.length;

        document.getElementById('totalUrls').textContent = totalUrls;
        document.getElementById('activeUrls').textContent = activeUrls;
        document.getElementById('totalRequests').textContent = totalRequests;
    }

    showConfirmModal(title, message, onConfirm) {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmOk');

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.add('show');

        const handleConfirm = () => {
            onConfirm();
            this.hideConfirmModal();
            confirmBtn.removeEventListener('click', handleConfirm);
        };

        confirmBtn.addEventListener('click', handleConfirm);
    }

    hideConfirmModal() {
        document.getElementById('confirmModal').classList.remove('show');
    }

    showNotification(type, message) {
        const notification = document.getElementById('notification');
        const icon = notification.querySelector('.notification-icon');
        const messageEl = notification.querySelector('.notification-message');

        // 设置图标
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        icon.className = `notification-icon ${icons[type] || icons.info}`;
        messageEl.textContent = message;
        
        notification.className = `notification ${type}`;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    getLogStatusClass(status) {
        // 处理各种网络错误代码
        if (status === 'ENOTFOUND' || status === 'ECONNREFUSED' || status === 'ETIMEDOUT' || 
            status === 'EAI_AGAIN' || status === 'ENETUNREACH' || status === 'EHOSTUNREACH' ||
            status === 'ECONNRESET' || status === 'EPIPE' || status === 'ECANCELED') {
            return 'log-status-error';
        } else if (typeof status === 'number') {
            if (status >= 200 && status < 300) {
                return 'log-status-2xx';
            } else if (status >= 400 && status < 500) {
                return 'log-status-4xx';
            } else if (status >= 500) {
                return 'log-status-5xx';
            }
        } else if (typeof status === 'string' && status.match(/^\d{3}$/)) {
            // 如果是字符串形式的数字状态码
            const numStatus = parseInt(status);
            if (numStatus >= 200 && numStatus < 300) {
                return 'log-status-2xx';
            } else if (numStatus >= 400 && numStatus < 500) {
                return 'log-status-4xx';
            } else if (numStatus >= 500) {
                return 'log-status-5xx';
            }
        }
        return 'log-status-2xx';
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// 初始化应用 - 不再添加示例数据
let app;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，初始化应用...');
    app = new AppState();
});

// 全局错误处理
window.addEventListener('error', (e) => {
    console.error('应用错误:', e.error);
    if (app) {
        app.showNotification('error', '系统发生错误，请刷新页面重试');
    }
});
