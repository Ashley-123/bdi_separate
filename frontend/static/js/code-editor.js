/**
 * code-editor.js
 * 基于Pyodide的代码编辑运行器
 */

// 全局Pyodide实例
let pyodide = null;
let pyodideLoading = false;
let pyodideLoadingPromise = null;

// 初始化Pyodide
async function initPyodide() {
  if (pyodide !== null) return pyodide;
  if (pyodideLoading) return pyodideLoadingPromise;

  pyodideLoading = true;
  
  try {
    // 显示加载提示
    const loadingElement = document.getElementById('pyodide-loading-status');
    if (loadingElement) {
      loadingElement.style.display = 'block';
      loadingElement.textContent = '正在加载 Python 环境...';
    }
    
    // 加载Pyodide
    pyodideLoadingPromise = loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
    });
    
    pyodide = await pyodideLoadingPromise;
    
    // 加载常用科学计算库
    await pyodide.loadPackagesFromImports('import numpy, pandas, matplotlib');
    
    // 设置matplotlib在web环境下工作
    await pyodide.runPythonAsync(`
      import matplotlib.pyplot as plt
      import io, base64
      from js import document
      plt.switch_backend('agg')
      
      def show_plot():
          buf = io.BytesIO()
          plt.savefig(buf, format='png')
          buf.seek(0)
          img_str = 'data:image/png;base64,' + base64.b64encode(buf.read()).decode('UTF-8')
          return img_str
    `);
    
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    return pyodide;
  } catch (error) {
    console.error('Pyodide加载失败:', error);
    const loadingElement = document.getElementById('pyodide-loading-status');
    if (loadingElement) {
      loadingElement.textContent = 'Python环境加载失败，请刷新页面重试';
      loadingElement.style.color = 'red';
    }
    throw error;
  } finally {
    pyodideLoading = false;
  }
}

// 执行Python代码并返回结果
async function runPythonCode(code, outputElement) {
  try {
    if (!pyodide) {
      await initPyodide();
    }
    
    // 创建输出元素
    const outputDiv = document.createElement('div');
    outputDiv.className = 'code-output';
    
    try {
      // 清除之前的图表
      await pyodide.runPythonAsync('plt.clf()');
      
      // 重定向stdout输出
      await pyodide.runPythonAsync(`
        import sys
        import io
        
        class CaptureStdout:
            def __init__(self):
                self.stdout = io.StringIO()
            
            def __enter__(self):
                sys.stdout = self.stdout
                return self.stdout
            
            def __exit__(self, *args):
                sys.stdout = sys.__stdout__
        
        _stdout_capture = CaptureStdout()
      `);
      
      // 在捕获标准输出的环境中执行代码
      let stdoutCapture;
      const result = await pyodide.runPythonAsync(`
        with _stdout_capture as stdout_capture:
            try:
                __result = eval(${JSON.stringify(code)})
            except:
                try:
                    exec(${JSON.stringify(code)})
                    __result = None
                except Exception as e:
                    print(f"错误: {type(e).__name__}: {str(e)}")
                    __result = None
            
            stdout_content = stdout_capture.getvalue()
        
        # 返回标准输出和结果
        [stdout_content, __result]
      `);
      
      // 从结果中提取标准输出和返回值
      const [stdoutContent, codeResult] = result;
      
      // 检查是否有stdout输出，并显示
      if (stdoutContent && stdoutContent.trim() !== '') {
        const stdoutElement = document.createElement('pre');
        stdoutElement.className = 'stdout-output';
        stdoutElement.textContent = stdoutContent;
        outputDiv.appendChild(stdoutElement);
        
        // 检查输出中是否包含错误信息
        if (stdoutContent.includes('错误:')) {
          // 已经在stdout中包含了错误信息，不需要额外处理
        }
      }
      
      // 检查是否有图表输出
      const hasPlot = code.includes('plt.') && (
        code.includes('plt.show()') || 
        code.includes('plt.plot') || 
        code.includes('plt.figure') ||
        code.includes('plt.bar') ||
        code.includes('plt.hist') ||
        code.includes('plt.scatter')
      );
      
      // 如果代码中有plt.show()或其他绘图操作，显示图表
      if (hasPlot) {
        const imgData = await pyodide.runPythonAsync('show_plot()');
        const imgElement = document.createElement('img');
        imgElement.src = imgData;
        imgElement.className = 'plot-output';
        outputDiv.appendChild(imgElement);
      }
      
      // 显示返回值结果（如果有，且不同于stdout）
      if (codeResult !== undefined && codeResult !== null) {
        const resultStr = codeResult.toString();
        if (resultStr && resultStr !== 'undefined' && resultStr !== 'None' && 
            (!stdoutContent || !stdoutContent.includes(resultStr))) {
          const preElement = document.createElement('pre');
          preElement.className = 'result-output';
          preElement.textContent = resultStr;
          outputDiv.appendChild(preElement);
        }
      }
    } catch (err) {
      // 处理和显示错误信息
      const errorElement = document.createElement('div');
      errorElement.className = 'error-output';
      
      // 格式化错误消息使其更友好
      let errorMessage = err.message || String(err);
      
      // 处理常见的Python错误类型
      if (errorMessage.includes('NameError')) {
        errorMessage = errorMessage.replace(/NameError: name '(\w+)' is not defined/, 
          "变量错误: '$1' 未定义，请检查变量名是否正确或是否忘记导入相关模块");
      } else if (errorMessage.includes('SyntaxError')) {
        errorMessage = errorMessage.replace(/SyntaxError: /, 
          "语法错误: 代码语法有误，请检查括号、冒号、缩进等 - ");
      } else if (errorMessage.includes('ImportError') || errorMessage.includes('ModuleNotFoundError')) {
        errorMessage = errorMessage.replace(/(ImportError|ModuleNotFoundError): /, 
          "导入错误: 无法导入模块，请确认模块名称正确且已安装 - ");
      } else if (errorMessage.includes('TypeError')) {
        errorMessage = errorMessage.replace(/TypeError: /, 
          "类型错误: 操作应用于不适当的类型 - ");
      } else if (errorMessage.includes('ValueError')) {
        errorMessage = errorMessage.replace(/ValueError: /, 
          "值错误: 操作接收到具有正确类型但不适当值的参数 - ");
      } else if (errorMessage.includes('IndexError')) {
        errorMessage = errorMessage.replace(/IndexError: /, 
          "索引错误: 序列下标超出范围 - ");
      } else if (errorMessage.includes('KeyError')) {
        errorMessage = errorMessage.replace(/KeyError: /, 
          "键错误: 字典中不存在指定的键 - ");
      } else if (errorMessage.includes('AttributeError')) {
        errorMessage = errorMessage.replace(/AttributeError: /, 
          "属性错误: 对象没有指定的属性或方法 - ");
      } else if (errorMessage.includes('ZeroDivisionError')) {
        errorMessage = "除零错误: 尝试除以零";
      }
      
      errorElement.textContent = errorMessage;
      outputDiv.appendChild(errorElement);
    }
    
    // 清空并添加新的输出
    if (outputElement) {
      outputElement.innerHTML = '';
      outputElement.appendChild(outputDiv);
    }
    
  } catch (error) {
    console.error('运行Python代码失败:', error);
    if (outputElement) {
      outputElement.innerHTML = `<div class="error-output">运行失败: ${error.message || String(error)}</div>`;
    }
  }
}

// 创建代码编辑器组件
function createCodeEditor(parentElement, initialCode = '') {
  const editorContainer = document.createElement('div');
  editorContainer.className = 'code-editor-container';
  
  // 创建标题栏和工具栏
  const titleToolbar = document.createElement('div');
  titleToolbar.className = 'editor-title';
  titleToolbar.innerHTML = '<i class="bi bi-code-square"></i> Python 代码编辑器';
  
  // 创建按钮组并添加到标题栏
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'editor-buttons';
  
  // 运行按钮
  const runButton = document.createElement('button');
  runButton.className = 'run-code-btn';
  runButton.innerHTML = '<i class="bi bi-play-fill"></i> 运行';
  
  // 显示样例按钮容器
  const exampleButtonContainer = document.createElement('div');
  exampleButtonContainer.className = 'example-btn-container';
  
  // 显示样例按钮
  const exampleButton = document.createElement('button');
  exampleButton.className = 'example-code-btn';
  exampleButton.innerHTML = '<i class="bi bi-lightbulb"></i> 样例';
  
  // 清除按钮
  const clearButton = document.createElement('button');
  clearButton.className = 'clear-code-btn';
  clearButton.innerHTML = '<i class="bi bi-trash"></i> 清除';
  
  // 将样例按钮添加到容器
  exampleButtonContainer.appendChild(exampleButton);
  
  // 样例代码下拉菜单
  const exampleDropdown = document.createElement('div');
  exampleDropdown.className = 'example-dropdown';
  exampleDropdown.style.display = 'none';
  
  // 设置样例下拉菜单的样式
  exampleDropdown.style.minWidth = '150px';
  exampleDropdown.style.marginTop = '5px';
  exampleDropdown.style.maxHeight = '200px';
  exampleDropdown.style.overflowY = 'auto';
  exampleDropdown.style.position = 'absolute';
  exampleDropdown.style.top = '100%'; // 紧贴按钮底部
  exampleDropdown.style.left = '0';   // 与按钮左对齐
  exampleDropdown.style.zIndex = '9999';
  
  // 将下拉菜单添加到按钮容器
  exampleButtonContainer.appendChild(exampleDropdown);
  
  // 添加按钮到按钮组
  buttonGroup.appendChild(runButton);
  buttonGroup.appendChild(exampleButtonContainer);
  buttonGroup.appendChild(clearButton);
  
  // 添加按钮组到标题栏
  titleToolbar.appendChild(buttonGroup);
  
  // 创建代码编辑器
  const editor = document.createElement('textarea');
  editor.className = 'code-editor';
  editor.value = initialCode;
  editor.spellcheck = false;
  editor.placeholder = '输入Python代码...';
  
  // 加载状态
  const loadingStatus = document.createElement('div');
  loadingStatus.id = 'pyodide-loading-status';
  loadingStatus.className = 'loading-status';
  loadingStatus.style.display = 'none';
  
  // 代码输出区域
  const outputArea = document.createElement('div');
  outputArea.className = 'code-output-area';
  
  // 添加组件到容器
  editorContainer.appendChild(titleToolbar);
  editorContainer.appendChild(loadingStatus);
  editorContainer.appendChild(editor);
  editorContainer.appendChild(outputArea);
  
  // 添加到父元素
  parentElement.appendChild(editorContainer);
  
  // 添加样例到下拉菜单
  const examples = [
    {
      title: 'NumPy基础',
      code: `import numpy as np

# 创建数组并执行基本操作
arr = np.array([1, 2, 3, 4, 5])
print("原始数组:", arr)
print("数组的平方:", arr ** 2)
print("数组的平均值:", arr.mean())
print("数组的标准差:", arr.std())

# 创建二维数组
matrix = np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
print("\\n二维数组:\\n", matrix)
print("\\n转置矩阵:\\n", matrix.T)
print("\\n矩阵的行和:", matrix.sum(axis=1))
print("矩阵的列和:", matrix.sum(axis=0))`
    },
    {
      title: 'Pandas数据分析',
      code: `import pandas as pd
import numpy as np

# 创建示例数据
data = {
    '姓名': ['张三', '李四', '王五', '赵六', '钱七'],
    '年龄': [28, 34, 29, 42, 31],
    '城市': ['北京', '上海', '广州', '深圳', '杭州'],
    '薪资': [15000, 20000, 18000, 25000, 22000]
}

# 创建DataFrame
df = pd.DataFrame(data)
print("原始数据:\\n", df)

# 基本统计
print("\\n数值型数据统计描述:\\n", df.describe())

# 数据筛选
print("\\n薪资高于20000的记录:\\n", df[df['薪资'] > 20000])

# 分组计算
print("\\n各城市平均薪资:\\n", df.groupby('城市')['薪资'].mean())`
    },
    {
      title: 'Matplotlib绘图',
      code: `import numpy as np
import matplotlib.pyplot as plt

# 准备数据
categories = ['A', 'B', 'C', 'D', 'E']
values = [23, 17, 35, 29, 12]
colors = ['#FF9999', '#66B2FF', '#99FF99', '#FFCC99', '#FFFF99']

# 创建柱状图
plt.figure(figsize=(10, 5))
plt.bar(categories, values, color=colors)
plt.title('类别数据分布')
plt.xlabel('类别')
plt.ylabel('数值')
plt.grid(axis='y', linestyle='--', alpha=0.7)

# 显示图表
plt.tight_layout()
plt.show()`
    },
    {
      title: '数据可视化',
      code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# 创建示例数据
np.random.seed(42)
dates = pd.date_range('20230101', periods=12)
data = pd.DataFrame({
    '销售额': np.random.randint(100, 500, 12),
    '利润': np.random.randint(30, 150, 12)
}, index=dates)

# 双轴图表
fig, ax1 = plt.subplots(figsize=(10, 6))

# 第一个Y轴
color = 'tab:blue'
ax1.set_xlabel('日期')
ax1.set_ylabel('销售额', color=color)
ax1.plot(data.index, data['销售额'], color=color, marker='o')
ax1.tick_params(axis='y', labelcolor=color)

# 第二个Y轴
ax2 = ax1.twinx()
color = 'tab:red'
ax2.set_ylabel('利润', color=color)
ax2.plot(data.index, data['利润'], color=color, marker='s')
ax2.tick_params(axis='y', labelcolor=color)

# 添加标题和图例
plt.title('2023年月度销售额和利润')
fig.tight_layout()
plt.grid(True, alpha=0.3)
plt.show()`
    }
  ];
  
  // 添加样例到下拉菜单
  examples.forEach(example => {
    const item = document.createElement('div');
    item.className = 'example-item';
    item.textContent = example.title;
    item.style.padding = '6px 10px';
    item.style.cursor = 'pointer';
    item.style.color = '#333';
    item.style.borderBottom = '1px solid #eee';
    
    item.addEventListener('click', () => {
      editor.value = example.code;
      exampleDropdown.style.display = 'none';
    });
    exampleDropdown.appendChild(item);
  });
  
  // 事件处理
  runButton.addEventListener('click', async () => {
    const code = editor.value.trim();
    if (code) {
      runButton.disabled = true;
      runButton.innerHTML = '<i class="bi bi-hourglass"></i> 运行中...';
      await runPythonCode(code, outputArea);
      runButton.disabled = false;
      runButton.innerHTML = '<i class="bi bi-play-fill"></i> 运行';
    }
  });
  
  exampleButton.addEventListener('click', (event) => {
    // 显示/隐藏下拉菜单
    exampleDropdown.style.display = exampleDropdown.style.display === 'none' ? 'block' : 'none';
    
    // 阻止事件冒泡，防止点击按钮后立即被document的点击事件处理器关闭
    event.stopPropagation();
  });
  
  clearButton.addEventListener('click', () => {
    editor.value = '';
    outputArea.innerHTML = '';
  });
  
  // 点击其他地方时隐藏样例下拉菜单
  document.addEventListener('click', (event) => {
    // 如果点击的不是样例按钮或下拉菜单本身，则隐藏下拉菜单
    if (!exampleButton.contains(event.target) && !exampleDropdown.contains(event.target)) {
      exampleDropdown.style.display = 'none';
    }
  });
  
  // 返回编辑器接口
  return {
    container: editorContainer,
    getCode: () => editor.value,
    setCode: (code) => {
      editor.value = code;
    },
    clear: () => {
      editor.value = '';
      outputArea.innerHTML = '';
    }
  };
}

// 初始化代码编辑器
function initCodeEditor() {
  // 查找消息容器内的所有代码块
  document.querySelectorAll('.message-content .code-block').forEach(codeBlock => {
    if (codeBlock.classList.contains('python') || codeBlock.classList.contains('python3')) {
      // 如果代码块已经包含编辑器，则不再创建
      if (codeBlock.querySelector('.code-editor-container')) return;
      
      // 提取代码内容
      const codeText = codeBlock.textContent;
      
      // 创建"添加编辑器"按钮
      const addEditorBtn = document.createElement('button');
      addEditorBtn.className = 'add-editor-btn';
      addEditorBtn.innerHTML = '<i class="bi bi-play"></i> 创建编辑器';
      
      // 添加按钮到代码块
      codeBlock.appendChild(addEditorBtn);
      
      // 按钮点击事件
      addEditorBtn.addEventListener('click', () => {
        // 创建编辑器
        createCodeEditor(codeBlock, codeText);
        
        // 移除按钮
        addEditorBtn.remove();
      });
    }
  });
}

// 动态创建编辑器按钮
function attachEditorButtonsToPythonBlocks(mutationsList, observer) {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 检查新添加的节点中的Python代码块
          const codeBlocks = node.querySelectorAll('.code-block.python, .code-block.python3');
          codeBlocks.forEach(codeBlock => {
            // 检查是否已经有编辑器按钮
            if (!codeBlock.querySelector('.add-editor-btn') && !codeBlock.querySelector('.code-editor-container')) {
              // 提取代码内容
              const codeText = codeBlock.textContent;
              
              // 创建"添加编辑器"按钮
              const addEditorBtn = document.createElement('button');
              addEditorBtn.className = 'add-editor-btn';
              addEditorBtn.innerHTML = '<i class="bi bi-play"></i> 创建编辑器';
              
              // 添加按钮到代码块
              codeBlock.appendChild(addEditorBtn);
              
              // 按钮点击事件
              addEditorBtn.addEventListener('click', () => {
                // 创建编辑器
                createCodeEditor(codeBlock, codeText);
                
                // 移除按钮
                addEditorBtn.remove();
              });
            }
          });
        }
      });
    }
  }
}

// 创建独立的代码编辑器组件
function createStandaloneEditor(parentElement) {
  // 创建容器
  const editorWrapper = document.createElement('div');
  editorWrapper.className = 'standalone-editor-wrapper';
  
  // 直接创建编辑器，不需要额外的标题
  const editor = createCodeEditor(editorWrapper);
  
  // 添加到父元素
  parentElement.appendChild(editorWrapper);
  
  return editor;
}

// 在聊天消息中添加代码编辑器按钮
function setupCodeEditorObserver() {
  // 创建MutationObserver监听DOM变化
  const observer = new MutationObserver(attachEditorButtonsToPythonBlocks);
  
  // 开始监听
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) {
    observer.observe(chatMessages, { childList: true, subtree: true });
  }
  
  return observer;
}

// 导出模块函数
window.CodeEditor = {
  init: function() {
    // 添加样式
    this.addStyles();
    
    // 设置观察者监听新的代码块
    const observer = setupCodeEditorObserver();
    
    // 初始化已有的代码块
    initCodeEditor();
    
    // 添加菜单按钮
    this.addCodeEditorMenuButton();
    
    return { observer };
  },
  
  addStyles: function() {
    const style = document.createElement('style');
    style.textContent = `
      /* 代码编辑器样式 */
      .code-editor-container {
        margin: 10px 0;
        border: 1px solid #ddd;
        border-radius: 8px;
        overflow: hidden;
        background-color: #f7f9fc;
      }
      
      .editor-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background-color: #4a69bd;
        color: white;
        font-weight: bold;
      }
      
      .editor-title i {
        margin-right: 8px;
      }
      
      .editor-buttons {
        display: flex;
        gap: 10px;
      }
      
      .run-code-btn, .example-code-btn, .clear-code-btn {
        padding: 4px 10px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: white;
      }
      
      .run-code-btn i, .example-code-btn i, .clear-code-btn i {
        margin-right: 5px;
      }
      
      .run-code-btn {
        background-color: #28a745;
      }
      
      .run-code-btn:hover {
        background-color: #218838;
      }
      
      .run-code-btn:disabled {
        background-color: #6c757d;
        cursor: not-allowed;
      }
      
      .example-code-btn {
        background-color: #17a2b8;
      }
      
      .example-code-btn:hover {
        background-color: #138496;
      }
      
      .clear-code-btn {
        background-color: #dc3545;
      }
      
      .clear-code-btn:hover {
        background-color: #c82333;
      }
      
      .loading-status {
        margin: 5px 0;
        padding: 0 12px;
        color: #6c757d;
        font-style: italic;
        text-align: right;
      }
      
      .code-editor {
        width: 100%;
        min-height: 120px;
        padding: 12px;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 14px;
        line-height: 1.5;
        border: none;
        resize: vertical;
        background-color: #f8f9fa;
      }
      
      .code-output-area {
        padding: 10px;
        background-color: #fff;
        border-top: 1px solid #ddd;
        max-height: 300px;
        overflow-y: auto;
      }
      
      .result-output {
        margin: 0;
        padding: 8px;
        background-color: #f0f0f0;
        border-radius: 4px;
        white-space: pre-wrap;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      }
      
      .stdout-output {
        margin: 0 0 8px 0;
        padding: 8px;
        background-color: #e9f5ff;
        color: #333;
        border-left: 3px solid #0066cc;
        border-radius: 0 4px 4px 0;
        white-space: pre-wrap;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      }
      
      .error-output {
        margin: 0;
        padding: 8px;
        background-color: #fff5f5;
        color: #d9534f;
        border-left: 3px solid #d9534f;
        border-radius: 0 4px 4px 0;
        white-space: pre-wrap;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      }
      
      .plot-output {
        max-width: 100%;
        display: block;
        margin: 10px auto;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      
      .add-editor-btn {
        display: block;
        margin: 8px auto;
        padding: 5px 12px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .add-editor-btn:hover {
        background-color: #0069d9;
      }
      
      .add-editor-btn i {
        margin-right: 5px;
      }
      
      .example-btn-container {
        position: relative;
        display: inline-block;
      }
      
      .example-dropdown {
        position: absolute;
        background-color: #ffffff;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        width: auto;
        min-width: 250px;
        top: 100%;
        left: 0;
      }
      
      .example-item {
        padding: 6px 10px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        color: var(--text-color, #202124);
        font-size: 13px;
        font-weight: normal;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .example-item:last-child {
        border-bottom: none;
      }
      
      .example-item:hover {
        background-color: #f5f5f5;
      }
      
      /* 独立编辑器样式 */
      .standalone-editor-wrapper {
        margin: 15px 0;
        border: 1px solid #ddd;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }
    `;
    document.head.appendChild(style);
  },
  
  // 添加代码编辑器菜单按钮
  addCodeEditorMenuButton: function() {
    // 找到输入区域容器
    const inputContainer = document.querySelector('.input-container .input-wrapper');
    if (!inputContainer) return;
    
    // 删除可能存在的重复按钮
    const existingButtons = inputContainer.querySelectorAll('.code-editor-menu-btn');
    existingButtons.forEach(btn => btn.remove());
    
    // 创建按钮
    const editorButton = document.createElement('button');
    editorButton.className = 'code-editor-menu-btn';
    editorButton.innerHTML = '<i class="bi bi-code-square"></i>';
    editorButton.title = '创建Python代码编辑器';
    
    // 按钮点击事件
    editorButton.addEventListener('click', () => {
      // 找到聊天消息容器
      const chatMessages = document.getElementById('chat-messages');
      if (!chatMessages) return;
      
      // 创建消息容器
      const messageElement = document.createElement('div');
      messageElement.className = 'message bot-message';
      
      const avatarElement = document.createElement('div');
      avatarElement.className = 'avatar';
      avatarElement.innerHTML = '<i class="bi bi-robot"></i>';
      
      const contentElement = document.createElement('div');
      contentElement.className = 'message-content';
      
      const editorHeaderElement = document.createElement('div');
      editorHeaderElement.className = 'message-header';
      editorHeaderElement.innerHTML = '<strong>Python 代码编辑器</strong>';
      
      contentElement.appendChild(editorHeaderElement);
      
      // 添加到消息
      messageElement.appendChild(avatarElement);
      messageElement.appendChild(contentElement);
      
      // 创建独立编辑器
      createStandaloneEditor(contentElement);
      
      // 添加到聊天
      chatMessages.appendChild(messageElement);
      
      // 滚动到底部
      if (typeof scrollToBottom === 'function') {
        scrollToBottom();
      } else {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    });
    
    // 查找发送按钮，将编辑器按钮添加到发送按钮前面
    const sendButton = inputContainer.querySelector('.send-btn');
    if (sendButton) {
      inputContainer.insertBefore(editorButton, sendButton);
    } else {
      // 如果没有找到发送按钮，则添加到容器末尾
      inputContainer.appendChild(editorButton);
    }
  }
};

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 初始化代码编辑器功能
  window.CodeEditor.init();
}); 