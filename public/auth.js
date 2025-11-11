/**
 * 认证服务模块
 * 处理用户登录、注册、token管理和页面跳转
 */
class AuthService {
    constructor() {
        this.API_BASE = 'http://localhost:3000/api/auth';
        this.init();
    }

    /**
     * 初始化认证服务
     */
    init() {
        // 检查当前页面类型
        const currentPage = this.getCurrentPage();

        if (currentPage === 'login') {
            this.initLoginPage();
        } else if (currentPage === 'register') {
            this.initRegisterPage();
        }

        // 检查是否已登录，如果已登录则跳转到主页面
        this.checkAuthStatus();
    }

    /**
     * 获取当前页面类型
     */
    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('login.html')) {
            return 'login';
        } else if (path.includes('register.html')) {
            return 'register';
        }
        return 'main';
    }

    /**
     * 检查认证状态
     */
    checkAuthStatus() {
        const token = this.getToken();
        if (token && this.getCurrentPage() !== 'main') {
            // 已登录用户访问认证页面，跳转到主页面
            window.location.href = 'index.html';
        } else if (!token && this.getCurrentPage() === 'main') {
            // 未登录用户访问主页面，跳转到登录页面
            window.location.href = 'login.html';
        }
    }

    /**
     * 初始化登录页面
     */
    initLoginPage() {
        const form = document.getElementById('login-form');
        const registerLink = document.getElementById('register-link');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'register.html';
        });
    }

    /**
     * 初始化注册页面
     */
    initRegisterPage() {
        const form = document.getElementById('register-form');
        const loginLink = document.getElementById('login-link');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'login.html';
        });
    }

    /**
     * 处理用户登录
     */
    async handleLogin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        // 清空之前的错误信息
        this.clearErrors();

        // 验证输入
        if (!username || !password) {
            this.showError('username', '请输入用户名和密码');
            return;
        }

        // 显示加载状态
        this.setLoading(true);

        try {
            const response = await fetch(`${this.API_BASE}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const result = await response.json();

            if (response.ok) {
                // 登录成功
                this.setToken(result.token);
                this.setUser(result.user);
                this.showSuccess('登录成功，正在跳转...');

                // 延迟跳转，让用户看到成功消息
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                // 登录失败
                this.showError('username', result.error || '登录失败');
            }
        } catch (error) {
            console.error('登录错误:', error);
            this.showError('username', '网络错误，请稍后重试');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 处理用户注册
     */
    async handleRegister() {
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // 清空之前的错误信息
        this.clearErrors();

        // 验证输入
        if (!username || !email || !password || !confirmPassword) {
            this.showError('username', '请填写所有必填字段');
            return;
        }

        if (username.length < 3) {
            this.showError('username', '用户名至少需要3个字符');
            return;
        }

        if (password.length < 6) {
            this.showError('password', '密码至少需要6个字符');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('confirm-password', '两次输入的密码不一致');
            return;
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showError('email', '请输入有效的邮箱地址');
            return;
        }

        // 显示加载状态
        this.setLoading(true);

        try {
            const response = await fetch(`${this.API_BASE}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password
                })
            });

            const result = await response.json();

            if (response.ok) {
                // 注册成功
                this.setToken(result.token);
                this.setUser(result.user);
                this.showSuccess('注册成功，正在跳转...');

                // 延迟跳转，让用户看到成功消息
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                // 注册失败
                if (result.error.includes('用户名')) {
                    this.showError('username', result.error);
                } else if (result.error.includes('邮箱')) {
                    this.showError('email', result.error);
                } else if (result.error.includes('密码')) {
                    this.showError('password', result.error);
                } else {
                    this.showError('username', result.error);
                }
            }
        } catch (error) {
            console.error('注册错误:', error);
            this.showError('username', '网络错误，请稍后重试');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 获取存储的token
     */
    getToken() {
        return localStorage.getItem('auth_token');
    }

    /**
     * 设置token到本地存储
     */
    setToken(token) {
        localStorage.setItem('auth_token', token);
    }

    /**
     * 获取存储的用户信息
     */
    getUser() {
        const userStr = localStorage.getItem('user_info');
        return userStr ? JSON.parse(userStr) : null;
    }

    /**
     * 设置用户信息到本地存储
     */
    setUser(user) {
        localStorage.setItem('user_info', JSON.stringify(user));
    }

    /**
     * 清除认证信息（登出）
     */
    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.href = 'login.html';
    }

    /**
     * 显示错误信息
     */
    showError(field, message) {
        const errorElement = document.getElementById(`${field}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    /**
     * 清空所有错误信息
     */
    clearErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(element => {
            element.textContent = '';
            element.style.display = 'none';
        });
    }

    /**
     * 显示成功消息
     */
    showSuccess(message) {
        // 创建成功提示元素
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #28a745;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            font-weight: 500;
        `;

        document.body.appendChild(successDiv);

        // 自动移除
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    /**
     * 设置加载状态
     */
    setLoading(loading) {
        const submitBtn = document.querySelector('.btn[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = loading;
            submitBtn.textContent = loading ?
                (this.getCurrentPage() === 'login' ? '登录中...' : '注册中...') :
                (this.getCurrentPage() === 'login' ? '登录' : '注册');
        }
    }

    /**
     * 获取认证头（用于API请求）
     */
    getAuthHeaders() {
        const token = this.getToken();
        return token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };
    }
}

// 创建全局认证服务实例
const authService = new AuthService();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 认证服务已在构造函数中初始化
});
