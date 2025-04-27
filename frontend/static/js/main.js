// DOM元素
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const historyList = document.getElementById('history-list');
const newChatButton = document.getElementById('new-chat-btn');
const settingsButton = document.getElementById('settings-btn');
const settingsDropdown = document.getElementById('settings-dropdown');
const clearHistoryButton = document.getElementById('clear-history');
const reasoningToggle = document.getElementById('reasoning-toggle');
const aboutUsButton = document.getElementById('about-us');
const aboutModal = document.getElementById('about-modal');
const connectionStatus = document.getElementById('connection-status');
const closeModalButton = document.querySelector('.close-modal');
const reasoningSidebar = document.getElementById('reasoning-sidebar');
const reasoningContent = document.getElementById('reasoning-content');

// 项目相关DOM元素
const projectsList = document.getElementById('projects-list');
const chatsList = document.getElementById('chats-list');
const addProjectBtn = document.getElementById('add-project-btn');
const projectConfigModal = document.getElementById('project-config-modal');
const projectConfigForm = document.getElementById('project-config-form');
const projectIdInput = document.getElementById('project-id');
const projectNameInput = document.getElementById('project-name');
const projectWelcomeInput = document.getElementById('project-welcome-text');
const apiEndpointInput = document.getElementById('api-endpoint');
const selectedIcon = document.getElementById('selected-icon');
const iconGrid = document.getElementById('icon-grid');
const exampleQuestions = document.getElementById('example-questions');
const addExampleBtn = document.getElementById('add-example-btn');
const uploadBtn = document.getElementById('upload-btn');
const knowledgeUpload = document.getElementById('knowledge-upload');
const uploadFileList = document.getElementById('upload-file-list');
const deleteProjectBtn = document.getElementById('delete-project-btn');
const projectTitle = document.getElementById('project-title');
const projectWelcome = document.getElementById('project-welcome');
const exampleGrid = document.getElementById('example-grid');

// 项目和历史数据
let projects = [];
let currentProject = null;
let chatHistory = [];
let currentChatId = generateId();
let clientId = generateId(); // 唯一客户端ID

// WebSocket连接
let socket = null;
let isProcessing = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 初始重连延迟（毫秒）
let reconnectTimeout = null; // 存储重连定时器
let forcedDisconnect = false; // 标记是否是手动断开连接

// 当前推理元素
let currentReasoningContainer = null;
let currentMessageElement = null;

// 设置选项
let showReasoning = false;

// 服务器配置
let serverConfig = {
    backend: {
        api_url: '',
        ws_url: ''
    }
};

// 默认项目数据
const defaultProjects = [
    {
        id: 'hot-news',
        name: '热点追踪',
        icon: 'bi-fire',
        welcome: '追踪实时热点新闻和事件，了解最新动态',
        examples: [
            {
                icon: 'bi-globe',
                text: '最近有哪些重要的国际新闻？'
            },
            {
                icon: 'bi-cpu',
                text: '帮我梳理一下近期的科技行业动态'
            },
            {
                icon: 'bi-people',
                text: '最近有哪些热门社会事件？'
            },
            {
                icon: 'bi-cash-coin',
                text: '帮我总结一下近期的经济政策变化'
            }
        ],
        api: '',
        knowledgeFiles: []
    },
    {
        id: 'market-analysis',
        name: '大盘分析',
        icon: 'bi-graph-up',
        welcome: '分析股市行情和市场趋势，助您做出更明智的投资决策',
        examples: [
            {
                icon: 'bi-currency-dollar',
                text: '请分析近期A股市场走势'
            },
            {
                icon: 'bi-bank',
                text: '最近哪些行业表现较好？'
            },
            {
                icon: 'bi-coin',
                text: '分析一下当前宏观经济对股市的影响'
            },
            {
                icon: 'bi-graph-up-arrow',
                text: '帮我解读最新的央行货币政策'
            }
        ],
        api: '',
        knowledgeFiles: []
    },
    {
        id: 'k-quant',
        name: '探索K-Quant',
        icon: 'bi-cpu',
        welcome: '了解K-Quant量化交易系统，探索AI在金融领域的应用',
        examples: [
            {
                icon: 'bi-robot',
                text: 'K-Quant系统的核心功能有哪些？'
            },
            {
                icon: 'bi-code-square',
                text: '如何使用K-Quant进行策略开发？'
            },
            {
                icon: 'bi-gear',
                text: '多因子模型在K-Quant中如何实现？'
            },
            {
                icon: 'bi-book',
                text: '有哪些常用的量化交易指标？'
            }
        ],
        api: '',
        knowledgeFiles: []
    }
];

// 初始化
async function init() {
    // 加载服务器配置
    await loadServerConfig();
    
    // 从本地存储加载设置
    loadSettings();
    
    // 加载项目数据
    loadProjects();
    
    // 从本地存储加载聊天历史
    loadChatHistory();
    
    // 初始化WebSocket连接
    connectWebSocket();
    
    // 事件监听器
    setupEventListeners();
    
    // 自动调整textarea高度
    setupAutoResizeTextarea();
    
    // 初始隐藏连接状态
    setTimeout(() => {
        connectionStatus.classList.add('fade-out');
    }, 3000);

    // 初始隐藏推理侧边栏
    toggleReasoningSidebar(showReasoning);
    
    // 显示默认项目内容
    displayProjectContent('hot-news');
    
    // 初始化代码编辑器
    if (window.CodeEditor) {
        window.CodeEditor.init();
    }
}

// 加载服务器配置
async function loadServerConfig() {
    try {
        const response = await fetch('/config');
        if (!response.ok) {
            console.error('加载服务器配置失败，使用默认配置');
            // 根据当前环境选择不同的默认配置
            if (window.location.hostname === '10.100.0.231' || 
                window.location.hostname.includes('localhost') || 
                window.location.hostname.includes('127.0.0.1')) {
                // 内网环境默认配置
                console.log('使用内网默认配置');
                serverConfig.backend.ws_url = 'ws://10.100.0.231:8001';
                serverConfig.backend.api_url = 'http://10.100.0.231:8001/fintech/api';
            } else if (window.location.hostname.includes('mdi.hkust-gz.edu.cn')) {
                // 外网环境默认配置
                console.log('使用外网默认配置');
                serverConfig.backend.ws_url = 'wss://mdi.hkust-gz.edu.cn/fintech';
                serverConfig.backend.api_url = '/fintech/api';
            } else {
                // 通用回退配置
                console.log('使用通用回退配置');
                serverConfig.backend.ws_url = window.location.protocol === 'https:' ? 
                    'wss://' + window.location.host + '/fintech' : 
                    'ws://' + window.location.host + '/fintech';
                serverConfig.backend.api_url = '/fintech/api';
            }
            return;
        }
        
        const config = await response.json();
        serverConfig = config;
        console.log('已加载服务器配置:', serverConfig);
    } catch (error) {
        console.error('加载服务器配置失败:', error);
        // 根据当前环境选择不同的默认配置
        if (window.location.hostname === '10.100.0.231' || 
            window.location.hostname.includes('localhost') || 
            window.location.hostname.includes('127.0.0.1')) {
            // 内网环境默认配置
            console.log('使用内网默认配置');
            serverConfig.backend.ws_url = 'ws://10.100.0.231:8001';
            serverConfig.backend.api_url = 'http://10.100.0.231:8001/fintech/api';
        } else if (window.location.hostname.includes('mdi.hkust-gz.edu.cn')) {
            // 外网环境默认配置
            console.log('使用外网默认配置');
            serverConfig.backend.ws_url = 'wss://mdi.hkust-gz.edu.cn/fintech';
            serverConfig.backend.api_url = '/fintech/api';
        } else {
            // 通用回退配置
            console.log('使用通用回退配置');
            serverConfig.backend.ws_url = window.location.protocol === 'https:' ? 
                'wss://' + window.location.host + '/fintech' : 
                'ws://' + window.location.host + '/fintech';
            serverConfig.backend.api_url = '/fintech/api';
        }
    }
}

// 加载项目数据
function loadProjects() {
    const savedProjects = localStorage.getItem('projects');
    
    if (savedProjects) {
        try {
            projects = JSON.parse(savedProjects);
        } catch (e) {
            console.error('加载项目数据失败:', e);
            projects = [...defaultProjects];
            saveProjects();
        }
    } else {
        projects = [...defaultProjects];
        saveProjects();
    }
    
    // 更新项目列表显示
    updateProjectsLists();
}

// 保存项目数据
function saveProjects() {
    try {
        localStorage.setItem('projects', JSON.stringify(projects));
    } catch (e) {
        console.error('保存项目数据失败:', e);
    }
}

// 更新项目列表和对话项目列表
function updateProjectsLists() {
    // 清空项目列表
    projectsList.innerHTML = '';
    chatsList.innerHTML = '';
    
    // 更新项目列表
    projects.forEach(project => {
        // 添加到项目列表
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        projectItem.dataset.projectId = project.id;
        
        projectItem.innerHTML = `
            <i class="bi ${project.icon}"></i>
            <span>${project.name}</span>
            <button class="project-config-btn" data-project-id="${project.id}">
                <i class="bi bi-gear"></i>
            </button>
            <button class="project-delete-btn" data-project-id="${project.id}">
                <i class="bi bi-x"></i>
            </button>
        `;
        
        projectItem.addEventListener('click', () => displayProjectContent(project.id));
        
        const configBtn = projectItem.querySelector('.project-config-btn');
        configBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openProjectConfig(project.id);
        });
        
        const deleteBtn = projectItem.querySelector('.project-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDeleteProject(project.id);
        });
        
        projectsList.appendChild(projectItem);
        
        // 创建项目对话组
        const chatProjectGroup = document.createElement('div');
        chatProjectGroup.className = 'chat-project-group';
        
        // 创建项目对话头部
        const chatProjectItem = document.createElement('div');
        chatProjectItem.className = 'chat-project-item';
        chatProjectItem.dataset.projectId = project.id;
        
        chatProjectItem.innerHTML = `
            <div class="chat-project-info">
                <i class="bi ${project.icon}"></i>
                <span>${project.name}</span>
            </div>
            <button class="start-chat-btn" data-project-id="${project.id}">
                <i class="bi bi-plus-lg"></i>
            </button>
        `;
        
        const startChatBtn = chatProjectItem.querySelector('.start-chat-btn');
        startChatBtn.addEventListener('click', () => startNewChat(project.id));
        
        // 创建项目历史记录列表
        const chatHistoryList = document.createElement('div');
        chatHistoryList.className = 'chat-history-list';
        chatHistoryList.dataset.projectId = project.id;
        
        // 将历史记录添加到列表
        addProjectHistoryItems(chatHistoryList, project.id);
        
        // 组装项目组
        chatProjectGroup.appendChild(chatProjectItem);
        chatProjectGroup.appendChild(chatHistoryList);
        
        // 添加到对话列表
        chatsList.appendChild(chatProjectGroup);
    });
}

// 为项目添加历史记录项
function addProjectHistoryItems(container, projectId) {
    // 清空容器
    container.innerHTML = '';
    
    // 过滤并排序该项目的历史记录
    const projectHistory = chatHistory
        .filter(chat => chat.projectId === projectId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (projectHistory.length === 0) {
        // 如果没有历史记录，显示空提示
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-history';
        emptyMsg.textContent = '暂无对话记录';
        container.appendChild(emptyMsg);
        return;
    }
    
    // 添加历史记录项
    projectHistory.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.chatId = chat.id;
        
        if (chat.id === currentChatId) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="history-item-content">
                <i class="bi bi-chat-text"></i>
                <span>${chat.title}</span>
            </div>
            <button class="history-delete-btn" data-chat-id="${chat.id}">
                <i class="bi bi-x"></i>
            </button>
        `;
        
        // 点击历史记录项加载对话
        const contentArea = item.querySelector('.history-item-content');
        contentArea.addEventListener('click', () => loadChat(chat.id));
        
        // 点击删除按钮删除历史记录
        const deleteBtn = item.querySelector('.history-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDeleteChat(chat.id);
        });
        
        container.appendChild(item);
    });
}

// 显示项目内容
function displayProjectContent(projectId) {
    const project = findProject(projectId);
    if (!project) return;
    
    currentProject = project;
    
    // 更新欢迎屏幕
    projectTitle.textContent = project.name;
    projectWelcome.textContent = project.welcome;
    
    // 更新示例问题
    exampleGrid.innerHTML = '';
    
    project.examples.forEach(example => {
        const exampleCard = document.createElement('div');
        exampleCard.className = 'example-card';
        exampleCard.onclick = () => setPrompt(example.text);
        
        exampleCard.innerHTML = `
            <i class="bi ${example.icon}"></i>
            <p>${example.text}</p>
        `;
        
        exampleGrid.appendChild(exampleCard);
    });
    
    // 显示欢迎屏幕
    showWelcomeScreen();
}

// 查找项目
function findProject(projectId) {
    return projects.find(p => p.id === projectId);
}

// 打开项目配置模态框
function openProjectConfig(projectId) {
    const project = findProject(projectId) || {
        id: generateId(),
        name: '',
        icon: 'bi-chat',
        welcome: '',
        examples: [{ icon: 'bi-chat', text: '' }],
        api: '',
        knowledgeFiles: []
    };
    
    // 填充表单数据
    projectIdInput.value = project.id;
    projectNameInput.value = project.name;
    projectWelcomeInput.value = project.welcome;
    apiEndpointInput.value = project.api || '';
    
    // 设置选中的图标
    selectedIcon.innerHTML = `<i class="bi ${project.icon}"></i>`;
    selectedIcon.dataset.icon = project.icon;
    
    // 高亮图标网格中的选中图标
    const iconItems = iconGrid.querySelectorAll('.icon-item');
    iconItems.forEach(item => {
        if (item.dataset.icon === project.icon) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    // 填充示例问题
    exampleQuestions.innerHTML = '';
    project.examples.forEach(example => {
        addExampleQuestionField(example.text);
    });
    
    // 清空文件列表
    uploadFileList.textContent = project.knowledgeFiles.length > 0 
        ? `已上传 ${project.knowledgeFiles.length} 个文件` 
        : '未选择文件';
    
    // 显示模态框
    projectConfigModal.classList.add('show');
}

// 添加示例问题字段
function addExampleQuestionField(questionText = '') {
    const questionItem = document.createElement('div');
    questionItem.className = 'example-question-item';
    
    questionItem.innerHTML = `
        <input type="text" name="example-question" placeholder="输入示例问题" value="${questionText}" required>
        <button type="button" class="remove-example-btn"><i class="bi bi-x"></i></button>
    `;
    
    const removeBtn = questionItem.querySelector('.remove-example-btn');
    removeBtn.addEventListener('click', () => {
        if (exampleQuestions.children.length > 1) {
            questionItem.remove();
        }
    });
    
    exampleQuestions.appendChild(questionItem);
}

// 保存项目配置
function saveProjectConfig(e) {
    e.preventDefault();
    
    const projectId = projectIdInput.value;
    const projectName = projectNameInput.value;
    const projectIcon = selectedIcon.dataset.icon;
    const projectWelcomeText = projectWelcomeInput.value;
    const apiEndpoint = apiEndpointInput.value;
    
    // 收集示例问题
    const questionInputs = exampleQuestions.querySelectorAll('input[name="example-question"]');
    const examples = Array.from(questionInputs).map(input => {
        // 为每个示例问题选择更匹配的图标
        const text = input.value.toLowerCase();
        let icon = 'bi-chat';
        
        // 使用关键词匹配适合的图标
        if (text.includes('新闻') || text.includes('事件') || text.includes('热点')) {
            icon = 'bi-newspaper';
        } else if (text.includes('分析') || text.includes('趋势') || text.includes('走势')) {
            icon = 'bi-graph-up';
        } else if (text.includes('技术') || text.includes('科技') || text.includes('编程')) {
            icon = 'bi-code-slash';
        } else if (text.includes('金融') || text.includes('股市') || text.includes('市场')) {
            icon = 'bi-cash-coin';
        } else if (text.includes('教育') || text.includes('学习') || text.includes('知识')) {
            icon = 'bi-mortarboard';
        } else if (text.includes('数据') || text.includes('统计')) {
            icon = 'bi-clipboard-data';
        } else if (text.includes('全球') || text.includes('国际') || text.includes('世界')) {
            icon = 'bi-globe';
        } else if (text.includes('公司') || text.includes('企业') || text.includes('机构')) {
            icon = 'bi-building';
        } else if (text.includes('人') || text.includes('社会')) {
            icon = 'bi-people';
        }
        
        return {
            icon: icon,
            text: input.value
        };
    });
    
    // 查找现有项目或创建新项目
    const existingProjectIndex = projects.findIndex(p => p.id === projectId);
    
    const updatedProject = {
        id: projectId,
        name: projectName,
        icon: projectIcon,
        welcome: projectWelcomeText,
        examples: examples,
        api: apiEndpoint,
        knowledgeFiles: existingProjectIndex >= 0 ? projects[existingProjectIndex].knowledgeFiles : []
    };
    
    if (existingProjectIndex >= 0) {
        // 更新现有项目
        projects[existingProjectIndex] = updatedProject;
    } else {
        // 添加新项目
        projects.push(updatedProject);
    }
    
    // 保存项目数据
    saveProjects();
    
    // 更新UI
    updateProjectsLists();
    
    // 如果当前显示的是该项目，更新显示
    if (currentProject && currentProject.id === projectId) {
        displayProjectContent(projectId);
    }
    
    // 关闭模态框
    projectConfigModal.classList.remove('show');
}

// 确认删除项目
function confirmDeleteProject(projectId) {
    // 确认删除
    if (confirm('确定要删除此项目吗？相关的聊天记录也将被删除。')) {
        deleteProject(projectId);
    }
}

// 删除项目
function deleteProject(projectId) {
    // 检查是否是默认项目，如果是，则创建一个副本保存在projects中
    if (defaultProjects.some(p => p.id === projectId)) {
        // 移除现有项目
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex >= 0) {
            projects.splice(projectIndex, 1);
        }
    } else {
        // 非默认项目，直接从项目列表中移除
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex >= 0) {
            projects.splice(projectIndex, 1);
        }
    }
    
    // 保存项目配置
    saveProjects();
    
    // 删除相关的聊天记录
    chatHistory = chatHistory.filter(chat => chat.projectId !== projectId);
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    
    // 更新UI
    updateProjectsLists();
    
    // 如果当前显示的是该项目，切换到第一个项目
    if (currentProject && currentProject.id === projectId) {
        if (projects.length > 0) {
            displayProjectContent(projects[0].id);
        }
    }
}

// 开始新对话
function startNewChat(projectId) {
    // 清空聊天消息
    chatMessages.innerHTML = '';
    
    // 清空推理内容
    clearReasoningContent();
    
    // 显示项目内容
    displayProjectContent(projectId);
    
    // 生成新的聊天ID
    currentChatId = generateId();
    
    // 设置状态
    currentReasoningContainer = null;
    currentMessageElement = null;
    
    // 重置输入框
    userInput.value = '';
    updateSendButtonState();
}

// 设置提示文本
function setPrompt(text) {
    userInput.value = text;
    userInput.focus();
    updateSendButtonState();
    // 自动调整高度
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
}

// 设置事件监听器
function setupEventListeners() {
    // 发送按钮点击事件
    sendButton.addEventListener('click', sendMessage);
    
    // 输入框Enter事件
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 输入框内容变化事件
    userInput.addEventListener('input', updateSendButtonState);
    
    // 设置按钮点击事件
    settingsButton.addEventListener('click', toggleSettingsDropdown);
    
    // 清除历史记录按钮事件
    clearHistoryButton.addEventListener('click', () => {
        if (confirm('确定要清除所有历史记录吗？')) {
            clearChatHistory();
            settingsDropdown.classList.remove('show');
        }
    });
    
    // 更新推理过程显示设置监听器
    reasoningToggle.addEventListener('change', () => {
        showReasoning = reasoningToggle.checked;
        toggleReasoningSidebar(showReasoning);
        saveSettings();
        updateMessagesDisplay();
    });
    
    // 关于我们按钮事件
    aboutUsButton.addEventListener('click', () => {
        aboutModal.classList.add('show');
        settingsDropdown.classList.remove('show');
    });
    
    // 关闭模态框按钮事件
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('show');
        });
    });
    
    // 点击模态框背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
    
    // 添加项目按钮事件
    addProjectBtn.addEventListener('click', () => openProjectConfig());
    
    // 项目配置表单提交事件
    projectConfigForm.addEventListener('submit', saveProjectConfig);
    
    // 删除项目按钮事件
    deleteProjectBtn.addEventListener('click', () => {
        const projectId = projectIdInput.value;
        confirmDeleteProject(projectId);
        projectConfigModal.classList.remove('show');
    });
    
    // 添加示例问题按钮事件
    addExampleBtn.addEventListener('click', () => addExampleQuestionField());
    
    // 图标选择事件
    selectedIcon.addEventListener('click', () => {
        iconGrid.style.display = iconGrid.style.display === 'grid' ? 'none' : 'grid';
    });
    
    // 图标项点击事件
    iconGrid.querySelectorAll('.icon-item').forEach(item => {
        item.addEventListener('click', () => {
            const icon = item.dataset.icon;
            selectedIcon.innerHTML = `<i class="bi ${icon}"></i>`;
            selectedIcon.dataset.icon = icon;
            
            // 更新选中状态
            iconGrid.querySelectorAll('.icon-item').forEach(i => {
                i.classList.remove('selected');
            });
            item.classList.add('selected');
            
            // 隐藏图标网格
            iconGrid.style.display = 'none';
        });
    });
    
    // 文件上传按钮事件
    uploadBtn.addEventListener('click', () => {
        knowledgeUpload.click();
    });
    
    // 文件选择变化事件
    knowledgeUpload.addEventListener('change', () => {
        const files = knowledgeUpload.files;
        if (files.length > 0) {
            uploadFileList.textContent = `已选择 ${files.length} 个文件`;
            
            // 此处可以添加上传文件的逻辑
            // uploadKnowledgeFiles(files);
        } else {
            uploadFileList.textContent = '未选择文件';
        }
    });
    
    // 点击文档关闭设置下拉菜单
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.settings-menu') && !e.target.closest('.settings-dropdown')) {
            settingsDropdown.classList.remove('show');
        }
    });
}

// 连接WebSocket
function connectWebSocket() {
    let wsUrl;
    
    // 根据环境直接设置WebSocket URL
    if(window.location.hostname === '10.100.0.231' || window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')) {
        // 内网环境 - 直接连接后端
        wsUrl = `ws://10.100.0.231:8001/ws/chat/${clientId}`;
        console.log(`使用内网连接: ${wsUrl}`);
    } else {
        // 外网环境 - 通过API路径连接
        wsUrl = `wss://mdi.hkust-gz.edu.cn/fintech/api/ws/chat/${clientId}`;
        console.log(`使用外网连接: ${wsUrl}`);
    }
    
    // 如果已经强制断开，不再尝试重连
    if (forcedDisconnect) {
        console.log('WebSocket已强制断开，不再重连');
        return;
    }
    
    // 清除之前的重连定时器
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        console.log('WebSocket已连接或正在连接，无需重新连接');
        return;
    }
    
    // 断开现有连接
    if (socket) {
        try {
            socket.close();
        } catch (e) {
            console.error('关闭现有WebSocket连接时出错:', e);
        }
    }
    
    try {
        console.log(`尝试连接WebSocket: ${wsUrl}`);
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('WebSocket连接已建立');
            reconnectAttempts = 0; // 重置重连计数
            
            // 显示连接状态提示
            connectionStatus.classList.remove('fade-out');
            connectionStatus.innerHTML = '<i class="bi bi-check-circle-fill"></i><span>WebSocket连接已建立</span>';
            connectionStatus.style.backgroundColor = '#e8f5e9';
            connectionStatus.style.color = '#0f9d58';
            
            // 3秒后淡出
            setTimeout(() => {
                connectionStatus.classList.add('fade-out');
            }, 3000);
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const type = data.type;
                const content = data.content;
                
                switch (type) {
                    case 'processing':
                        showTypingIndicator();
                        break;
                        
                    case 'reasoning_start':
                        // 创建推理容器，但暂不显示内容
                        createReasoningContainer();
                        break;
                        
                    case 'reasoning_step':
                        // 添加推理步骤到现有推理容器
                        addReasoningStep(content);
                        break;
                        
                    case 'reasoning_end':
                        // 推理完成
                        finalizeReasoningContainer();
                        break;
                        
                    case 'result':
                        // 显示最终结果
                        removeTypingIndicator();
                        displayBotFinalResult(content);
                        
                        // 保存到历史记录
                        saveChatMessage('assistant', content);
                        
                        isProcessing = false;
                        updateSendButtonState();
                        break;
                        
                    case 'error':
                        // 显示错误消息
                        removeTypingIndicator();
                        displayErrorMessage(content);
                        
                        isProcessing = false;
                        updateSendButtonState();
                        break;
                        
                    default:
                        // 处理纯文本消息（向后兼容）
                        if (content === '处理中...') {
                            showTypingIndicator();
                        } else {
                            removeTypingIndicator();
                            displayBotMessage(content);
                            
                            // 保存到历史记录
                            saveChatMessage('assistant', content);
                            
                            isProcessing = false;
                            updateSendButtonState();
                        }
                }
            } catch (e) {
                // 如果不是JSON格式，按照之前的方式处理
                const message = event.data;
                
                if (message === '处理中...') {
                    showTypingIndicator();
                } else {
                    removeTypingIndicator();
                    displayBotMessage(message);
                    
                    // 保存到历史记录
                    saveChatMessage('assistant', message);
                    
                    isProcessing = false;
                    updateSendButtonState();
                }
            }
        };
        
        socket.onclose = (event) => {
            console.log(`WebSocket连接已关闭，代码: ${event.code}, 原因: ${event.reason}`);
            
            // 手动强制断开的情况下不显示状态提示
            if (!forcedDisconnect) {
                // 显示连接状态提示
                connectionStatus.classList.remove('fade-out');
                connectionStatus.innerHTML = '<i class="bi bi-x-circle"></i><span>WebSocket连接已断开</span>';
                connectionStatus.style.backgroundColor = '#fdeded';
                connectionStatus.style.color = '#842029';
                
                // 处理重连
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts);
                    reconnectAttempts++;
                    console.log(`${delay}毫秒后尝试重新连接 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                    
                    if (isProcessing) {
                        // 如果正在处理请求，通知用户
                        removeTypingIndicator();
                        displayStatusMessage(`连接已断开，${Math.round(delay/1000)}秒后重新连接...`);
                    }
                    
                    // 存储重连定时器引用
                    reconnectTimeout = setTimeout(connectWebSocket, delay);
                } else {
                    console.error('达到最大重连次数，停止尝试');
                    if (isProcessing) {
                        removeTypingIndicator();
                        displayErrorMessage('无法连接到服务器，请刷新页面重试');
                        isProcessing = false;
                        updateSendButtonState();
                    }
                }
            } else {
                console.log('手动断开连接，不尝试重连');
            }
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket错误:', error);
            
            // 显示连接状态提示
            connectionStatus.classList.remove('fade-out');
            connectionStatus.innerHTML = '<i class="bi bi-exclamation-triangle"></i><span>WebSocket连接错误</span>';
            connectionStatus.style.backgroundColor = '#fdeded';
            connectionStatus.style.color = '#842029';
            
            if (!forcedDisconnect) {
                displayErrorMessage('WebSocket连接错误，请确保服务器已启动且支持WebSocket');
            }
            isProcessing = false;
            updateSendButtonState();
        };
    } catch (e) {
        console.error('创建WebSocket连接时出错:', e);
        displayErrorMessage('创建WebSocket连接时出错，请确保浏览器支持WebSocket');
    }
}

// 保存设置到本地存储
function saveSettings() {
    const settings = {
        showReasoning: showReasoning
    };
    localStorage.setItem('settings', JSON.stringify(settings));
}

// 从本地存储加载设置
function loadSettings() {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            showReasoning = settings.showReasoning !== undefined ? settings.showReasoning : true;
            reasoningToggle.checked = showReasoning;
        } catch (e) {
            console.error('加载设置失败:', e);
            // 如果加载失败，默认显示推理过程
            showReasoning = true;
            reasoningToggle.checked = true;
        }
    } else {
        // 如果没有保存的设置，默认显示推理过程
        showReasoning = true;
        reasoningToggle.checked = true;
    }
    
    // 根据设置更新界面显示
    toggleReasoningSidebar(showReasoning);
    
    // 保存初始设置
    saveSettings();
}

// 切换显示/隐藏推理侧边栏
function toggleReasoningSidebar(show) {
    const reasoningSidebar = document.getElementById('reasoning-sidebar');
    if (show) {
        reasoningSidebar.style.display = 'flex';
    } else {
        reasoningSidebar.style.display = 'none';
    }
}

// 更新消息显示
function updateMessagesDisplay() {
    // 更新推理进程侧边栏显示状态
    toggleReasoningSidebar(showReasoning);
    
    // 如果不显示推理过程，但当前有推理内容，清空它
    if (!showReasoning) {
        clearReasoningContent();
    }
}

// 清除所有聊天历史
function clearChatHistory() {
    chatHistory = [];
    localStorage.removeItem('chatHistory');
    
    // 更新所有项目的历史记录列表
    document.querySelectorAll('.chat-history-list').forEach(list => {
        const projectId = list.dataset.projectId;
        addProjectHistoryItems(list, projectId);
    });
    
    // 开始新对话
    if (currentProject) {
        startNewChat(currentProject.id);
    }
}

// 发送消息
function sendMessage() {
    const message = userInput.value.trim();
    
    if (!message || isProcessing) {
        return;
    }
    
    // 隐藏欢迎屏幕
    hideWelcomeScreen();
    
    // 显示用户消息
    displayUserMessage(message);
    
    // 保存到历史记录
    saveChatMessage('user', message);
    
    // 重置强制断开标志，允许重新连接
    forcedDisconnect = false;
    
    // 发送到WebSocket
    if (socket && socket.readyState === WebSocket.OPEN) {
        try {
            const data = JSON.stringify({
                type: 'message',
                content: message
            });
            socket.send(data);
            isProcessing = true;
            updateSendButtonState();
        } catch (e) {
            console.error('发送消息时出错:', e);
            displayErrorMessage('发送消息时出错，请刷新页面重试');
        }
    } else {
        // 如果WebSocket未连接，尝试重新连接
        displayStatusMessage('正在连接服务器...');
        connectWebSocket();
        setTimeout(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                try {
                    const data = JSON.stringify({
                        type: 'message',
                        content: message
                    });
                    socket.send(data);
                    isProcessing = true;
                    updateSendButtonState();
                } catch (e) {
                    console.error('发送消息时出错:', e);
                    displayErrorMessage('发送消息时出错，请刷新页面重试');
                }
            } else {
                displayErrorMessage("无法连接服务器，请刷新页面重试");
                isProcessing = false;
                updateSendButtonState();
            }
        }, 1000);
    }
    
    // 清空输入框
    userInput.value = '';
    userInput.style.height = 'auto';
}

// 显示用户消息
function displayUserMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message user-message';
    
    messageElement.innerHTML = `
        <div class="message-header">
            <i class="bi bi-person-circle"></i>
            Admin
        </div>
        <div class="message-content">${formatMessage(message)}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    scrollToBottom();
}

// 显示机器人消息
function displayBotMessage(message) {
    // 如果有类型指示器，先移除它
    removeTypingIndicator();
    
    // 提取潜在的推理过程（在消息中用特定格式标记）
    let formattedMessage = message;
    let reasoningHtml = '';
    
    // 检查是否有推理过程标记（比如 [推理过程:开始] ... [推理过程:结束]）
    const reasoningMatch = message.match(/\[推理过程:开始\]([\s\S]*?)\[推理过程:结束\]/);
    if (reasoningMatch) {
        reasoningHtml = `
            <div class="reasoning-block" style="${showReasoning ? '' : 'display: none;'}">
                <div class="reasoning-title">推理过程:</div>
                ${formatMessage(reasoningMatch[1].trim())}
            </div>
        `;
        
        // 从消息中移除推理过程部分
        formattedMessage = message.replace(/\[推理过程:开始\]([\s\S]*?)\[推理过程:结束\]/, '');
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message bot-message';
    
    messageElement.innerHTML = `
        <div class="message-header">
            <i class="bi bi-robot"></i>
            HKUST(GZ) BDI
        </div>
        <div class="message-content">
            ${formatMessage(formattedMessage)}
            ${reasoningHtml}
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    scrollToBottom();
    
    // 如果是第一条消息，添加到历史记录
    updateChatHistoryTitle(message);
}

// 显示错误消息
function displayErrorMessage(message) {
    // 如果有类型指示器，先移除它
    removeTypingIndicator();
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message error-message';
    
    messageElement.innerHTML = `
        <div class="message-header">
            <i class="bi bi-exclamation-triangle-fill"></i>
            错误
        </div>
        <div class="message-content">${message}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    scrollToBottom();
}

// 显示状态消息
function displayStatusMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message status-message';
    
    messageElement.innerHTML = `
        <div class="message-header">
            <i class="bi bi-info-circle-fill"></i>
            系统
        </div>
        <div class="message-content">${message}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    scrollToBottom();
}

// 格式化消息
function formatMessage(message) {
    // 处理Markdown格式
    message = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    message = message.replace(/\*(.*?)\*/g, '<em>$1</em>');
    message = message.replace(/__(.*?)__/g, '<em>$1</em>');
    message = message.replace(/~~(.*?)~~/g, '<del>$1</del>');
    
    // 处理代码块
    message = message.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, language, code) {
        let languageClass = language ? 'language-' + language : '';
        let languageLabel = language ? language : 'code';
        
        // 为Python代码添加特殊类名，以便代码编辑器识别
        if (language.toLowerCase() === 'python' || language.toLowerCase() === 'python3') {
            languageClass += ' python';
        }
        
        // 处理代码的缩进和空格，确保HTML渲染时保留格式
        const formattedCode = escapeHtml(code);
        
        return `<div class="code-block-wrapper">
                  <div class="code-block-header">
                    <span class="code-language">${languageLabel}</span>
                    <button class="copy-code-btn" onclick="copyToClipboard(this)">
                      <i class="bi bi-clipboard"></i>
                    </button>
                  </div>
                  <pre class="code-block ${languageClass}">${formattedCode}</pre>
                </div>`;
    });
    
    // 处理内联代码
    message = message.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 处理链接
    message = message.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 处理换行
    message = message.replace(/\n/g, '<br>');
    
    return message;
}

// 显示正在输入指示器
function showTypingIndicator() {
    removeTypingIndicator(); // 确保没有重复的指示器
    
    const indicatorElement = document.createElement('div');
    indicatorElement.className = 'message bot-message typing-indicator';
    
    indicatorElement.innerHTML = `
        <div class="message-header">
            <i class="bi bi-robot"></i>
            HKUST(GZ) BDI
        </div>
        <div class="message-content">
            <div class="typing-animation">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(indicatorElement);
    scrollToBottom();
}

// 移除正在输入指示器
function removeTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// 隐藏欢迎屏幕
function hideWelcomeScreen() {
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
}

// 显示欢迎屏幕
function showWelcomeScreen() {
    if (welcomeScreen) {
        welcomeScreen.style.display = 'block';
    }
    
    // 清空聊天消息
    chatMessages.innerHTML = '';
}

// 滚动到底部
function scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 保存聊天消息到历史
function saveChatMessage(role, content) {
    // 查找当前对话
    const chatIndex = chatHistory.findIndex(chat => chat.id === currentChatId);
    
    if (chatIndex === -1) {
        // 创建新对话
        chatHistory.push({
            id: currentChatId,
            projectId: currentProject.id, // 记录项目ID
            title: getTitle(content),
            messages: [{role, content}],
            timestamp: new Date().toISOString()
        });
    } else {
        // 添加到现有对话
        chatHistory[chatIndex].messages.push({role, content});
    }
    
    // 保存到本地存储
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    
    // 更新对应项目的历史记录列表
    const historyList = document.querySelector(`.chat-history-list[data-project-id="${currentProject.id}"]`);
    if (historyList) {
        addProjectHistoryItems(historyList, currentProject.id);
    }
}

// 从聊天内容生成标题
function getTitle(content) {
    // 移除可能的推理过程标记
    let cleanContent = content.replace(/\[推理过程:开始\]([\s\S]*?)\[推理过程:结束\]/, '').trim();
    
    // 从内容中提取前20个字符作为标题
    const title = cleanContent.substring(0, 20).trim();
    return title.length > 0 ? title + '...' : '新对话';
}

// 更新聊天历史标题
function updateChatHistoryTitle(message) {
    if (chatHistory.length === 0) return;
    
    const chatIndex = chatHistory.findIndex(chat => chat.id === currentChatId);
    
    if (chatIndex !== -1 && chatHistory[chatIndex].messages.length <= 2) {
        // 仅用第一个助手响应更新标题
        chatHistory[chatIndex].title = getTitle(message);
        
        // 保存到本地存储
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        
        // 更新对应项目的历史记录列表
        const historyList = document.querySelector(`.chat-history-list[data-project-id="${currentProject.id}"]`);
        if (historyList) {
            addProjectHistoryItems(historyList, currentProject.id);
        }
    }
}

// 加载聊天历史
function loadChatHistory() {
    const savedHistory = localStorage.getItem('chatHistory');
    
    if (savedHistory) {
        try {
            chatHistory = JSON.parse(savedHistory);
            
            // 更新所有历史记录列表
            setTimeout(() => {
                document.querySelectorAll('.chat-history-list').forEach(list => {
                    const projectId = list.dataset.projectId;
                    addProjectHistoryItems(list, projectId);
                });
            }, 100); // 稍微延迟，确保DOM元素已经创建
        } catch (e) {
            console.error('加载聊天历史失败:', e);
            chatHistory = [];
        }
    }
}

// 更新历史列表
function updateHistoryList() {
    historyList.innerHTML = '';
    
    // 按时间倒序排列历史记录
    const sortedHistory = [...chatHistory].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    sortedHistory.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.chatId = chat.id;
        
        if (chat.id === currentChatId) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <i class="bi bi-chat-left-text"></i>
            <span>${chat.title}</span>
        `;
        
        item.addEventListener('click', () => loadChat(chat.id));
        
        historyList.appendChild(item);
    });
}

// 加载指定的聊天
function loadChat(chatId) {
    // 防止重复加载当前聊天
    if (chatId === currentChatId) {
        return;
    }
    
    // 查找聊天历史
    const chat = chatHistory.find(c => c.id === chatId);
    
    if (chat && chat.messages && chat.messages.length > 0) {
        // 隐藏欢迎屏幕
        hideWelcomeScreen();
        
        // 清空当前聊天内容
        chatMessages.innerHTML = '';
        
        // 清空推理内容
        clearReasoningContent();
        
        // 显示历史消息
        chat.messages.forEach(msg => {
            if (msg.role === 'user') {
                displayUserMessage(msg.content);
            } else if (msg.role === 'assistant') {
                displayBotMessage(msg.content);
            }
        });
        
        // 更新当前聊天ID
        currentChatId = chatId;
        
        // 查找项目ID并设置当前项目
        const projectId = chat.projectId;
        if (projectId) {
            const project = findProject(projectId);
            if (project) {
                currentProject = project;
            }
        }
        
        // 滚动到底部
        scrollToBottom();
        
        // 更新所有项目的历史记录，高亮当前对话
        document.querySelectorAll('.chat-history-list').forEach(list => {
            const projectId = list.dataset.projectId;
            addProjectHistoryItems(list, projectId);
        });
    }
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 添加CSS
function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .typing-animation {
            display: flex;
            align-items: center;
            column-gap: 6px;
        }
        
        .typing-animation span {
            height: 8px;
            width: 8px;
            background-color: var(--text-secondary);
            border-radius: 50%;
            display: block;
            opacity: 0.4;
        }
        
        .typing-animation span:nth-child(1) {
            animation: pulse 1s infinite ease-in-out;
        }
        
        .typing-animation span:nth-child(2) {
            animation: pulse 1s infinite ease-in-out .2s;
        }
        
        .typing-animation span:nth-child(3) {
            animation: pulse 1s infinite ease-in-out .4s;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
        }
        
        .error-message .message-content {
            background-color: #fdeded;
            border: 1px solid #f1aeb5;
            color: #842029;
        }
        
        .error-message .message-header {
            color: #842029;
        }
        
        .status-message .message-content {
            background-color: #e8f4fd;
            border: 1px solid #9ec5fe;
            color: #084298;
        }
        
        .status-message .message-header {
            color: #084298;
        }
        
        /* 代码块样式 */
        .code-block-wrapper {
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 6px;
            overflow: hidden;
            background-color: #f8f9fa;
        }
        
        .code-block-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 10px;
            background-color: #f0f0f0;
            border-bottom: 1px solid #ddd;
        }
        
        .code-language {
            font-size: 0.9em;
            color: #6c757d;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }
        
        .copy-code-btn {
            background: none;
            border: none;
            cursor: pointer;
            color: #6c757d;
            padding: 3px 6px;
            border-radius: 3px;
        }
        
        .copy-code-btn:hover {
            background-color: #e9ecef;
        }
        
        .code-block {
            margin: 0;
            padding: 10px;
            overflow-x: auto;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            line-height: 1.5;
            white-space: pre;
            tab-size: 4;
            -moz-tab-size: 4;
        }
    `;
    
    document.head.appendChild(style);
}

// 检查服务器版本信息
async function checkServerVersion() {
    try {
        // 使用配置中的API URL或回退到相对路径
        const apiUrl = serverConfig.backend.api_url || '';
        const url = `${apiUrl}/version`;
        
        // 如果是完整URL，直接使用；如果是空字符串，则使用相对路径
        const versionUrl = apiUrl ? url : '/api/version';
        
        console.log(`检查服务器版本，URL: ${versionUrl}`);
        const response = await fetch(versionUrl);
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        const data = await response.json();
        console.log(`服务器版本: ${data.version}`);
    } catch (error) {
        console.error('检查服务器版本失败:', error);
        // 在UI中显示错误
        connectionStatus.classList.remove('fade-out');
        connectionStatus.innerHTML = '<i class="bi bi-x-circle"></i><span>无法连接到服务器</span>';
        connectionStatus.style.backgroundColor = '#fdeded';
        connectionStatus.style.color = '#842029';
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    addDynamicStyles();
    init();
    checkServerVersion();
});

// 清除连接和定时器
function cleanupWebSocket() {
    // 标记为手动断开
    forcedDisconnect = true;
    
    // 清除重连定时器
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    
    // 关闭WebSocket连接
    if (socket) {
        try {
            socket.close();
        } catch (e) {
            console.error('关闭WebSocket连接时出错:', e);
        }
    }
}

// 创建推理容器 (在侧边栏中)
function createReasoningContainer() {
    // 清空之前的推理内容
    clearReasoningContent();
    
    // 如果设置为不显示推理过程，直接返回
    if (!showReasoning) return;
    
    // 显示推理侧边栏
    toggleReasoningSidebar(true);
    
    // 创建推理块
    const reasoningBlock = document.createElement('div');
    reasoningBlock.className = 'reasoning-block';
    
    // 创建推理标题
    const reasoningTitle = document.createElement('div');
    reasoningTitle.className = 'reasoning-title';
    reasoningTitle.innerHTML = '<i class="bi bi-lightbulb"></i> 思考中...';
    reasoningBlock.appendChild(reasoningTitle);
    
    // 创建推理内容容器
    const reasoningBlockContent = document.createElement('div');
    reasoningBlockContent.className = 'reasoning-content';
    reasoningBlock.appendChild(reasoningBlockContent);
    
    // 添加到推理侧边栏
    reasoningContent.appendChild(reasoningBlock);
    
    // 记录当前推理容器引用
    currentReasoningContainer = reasoningBlockContent;
}

// 清空推理内容
function clearReasoningContent() {
    reasoningContent.innerHTML = '';
    currentReasoningContainer = null;
}

// 添加推理步骤
function addReasoningStep(stepContent) {
    // 如果设置为不显示推理过程或容器未创建，直接返回
    if (!showReasoning || !currentReasoningContainer) return;
    
    // 创建推理步骤元素
    const stepElement = document.createElement('div');
    stepElement.className = 'reasoning-step';
    stepElement.innerText = stepContent;
    
    // 添加到当前推理容器
    currentReasoningContainer.appendChild(stepElement);
    
    // 滚动推理侧边栏到底部
    reasoningSidebar.scrollTop = reasoningSidebar.scrollHeight;
}

// 完成推理过程
function finalizeReasoningContainer() {
    // 如果设置为不显示推理过程或容器未创建，直接返回
    if (!showReasoning || !currentReasoningContainer) return;
    
    // 创建推理完成标记
    const completionElement = document.createElement('div');
    completionElement.className = 'reasoning-completion';
    completionElement.innerHTML = '<i class="bi bi-check-circle"></i> 推理完成';
    
    // 添加到当前推理容器所在的块
    currentReasoningContainer.parentElement.appendChild(completionElement);
    
    // 滚动推理侧边栏到底部
    reasoningSidebar.scrollTop = reasoningSidebar.scrollHeight;
}

// 显示最终结果 (不包含推理过程)
function displayBotFinalResult(resultContent) {
    // 创建消息元素
    const messageElement = document.createElement('div');
    messageElement.className = 'message bot-message';
    
    // 创建消息头部
    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';
    messageHeader.innerText = 'HKUST(GZ) BDI';
    messageElement.appendChild(messageHeader);
    
    // 创建消息内容容器
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // 格式化并添加结果内容
    const formattedContent = formatMessage(resultContent);
    messageContent.innerHTML = formattedContent;
    
    messageElement.appendChild(messageContent);
    
    // 添加到聊天消息区域
    chatMessages.appendChild(messageElement);
    
    // 滚动到底部
    scrollToBottom();
    
    // 记录当前消息元素
    currentMessageElement = messageElement;
    
    // 隐藏欢迎屏幕
    hideWelcomeScreen();
}

// 自动调整textarea高度
function setupAutoResizeTextarea() {
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

// 更新发送按钮状态
function updateSendButtonState() {
    const isEmpty = !userInput.value.trim();
    
    if (isEmpty || isProcessing) {
        sendButton.disabled = true;
        sendButton.classList.add('disabled');
    } else {
        sendButton.disabled = false;
        sendButton.classList.remove('disabled');
    }
}

// 切换设置下拉菜单
function toggleSettingsDropdown() {
    settingsDropdown.classList.toggle('show');
}

// 确认删除聊天记录
function confirmDeleteChat(chatId) {
    if (confirm('确定要删除此对话记录吗？')) {
        deleteChat(chatId);
    }
}

// 删除聊天记录
function deleteChat(chatId) {
    // 查找并记录项目ID
    const chat = chatHistory.find(c => c.id === chatId);
    let projectId = null;
    if (chat) {
        projectId = chat.projectId;
    }
    
    // 从历史记录中移除
    chatHistory = chatHistory.filter(chat => chat.id !== chatId);
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    
    // 如果是当前对话，清空显示并开始新对话
    if (chatId === currentChatId && currentProject) {
        startNewChat(currentProject.id);
    }
    
    // 如果能找到对应项目，只更新该项目的历史记录
    if (projectId) {
        const historyList = document.querySelector(`.chat-history-list[data-project-id="${projectId}"]`);
        if (historyList) {
            addProjectHistoryItems(historyList, projectId);
        }
    } else {
        // 否则更新所有历史记录
        updateProjectsLists();
    }
}

// 转义HTML特殊字符
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 复制代码到剪贴板
function copyToClipboard(button) {
    const codeBlock = button.closest('.code-block-wrapper').querySelector('.code-block');
    const code = codeBlock.textContent;
    
    // 处理代码格式，保留缩进
    const formattedCode = code
        .replace(/\u00A0/g, ' ') // 将不间断空格转换为普通空格
        .split('\n')
        .map(line => line.trimRight()) // 移除每行末尾多余空格
        .join('\n');
    
    navigator.clipboard.writeText(formattedCode).then(() => {
        // 更改按钮图标显示复制成功
        const icon = button.querySelector('i');
        icon.classList.remove('bi-clipboard');
        icon.classList.add('bi-check2');
        
        // 恢复原图标
        setTimeout(() => {
            icon.classList.remove('bi-check2');
            icon.classList.add('bi-clipboard');
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
    });
}

// 挂载到window对象以便全局调用
window.copyToClipboard = copyToClipboard;