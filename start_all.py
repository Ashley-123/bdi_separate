import subprocess
import sys
import os
import json
import time
import threading

# 获取当前脚本所在目录
current_dir = os.path.dirname(os.path.abspath(__file__))

def load_config():
    """尝试从前端和后端加载配置"""
    frontend_config_path = os.path.join(current_dir, "frontend", "config", "server_config.json")
    backend_config_path = os.path.join(current_dir, "backend", "config", "server_config.json")
    
    frontend_config = None
    backend_config = None
    
    try:
        with open(frontend_config_path, "r") as f:
            frontend_config = json.load(f)
    except Exception as e:
        print(f"加载前端配置文件失败: {str(e)}，将使用默认配置")
    
    try:
        with open(backend_config_path, "r") as f:
            backend_config = json.load(f)
    except Exception as e:
        print(f"加载后端配置文件失败: {str(e)}，将使用默认配置")
    
    return frontend_config, backend_config

def start_frontend():
    """启动前端服务"""
    frontend_script = os.path.join(current_dir, "frontend", "start_frontend.py")
    print("正在启动前端服务...")
    process = subprocess.Popen([sys.executable, frontend_script], 
                              stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT,
                              universal_newlines=True)
    
    # 实时输出前端日志
    for line in process.stdout:
        print(f"[前端] {line.strip()}")

def start_backend():
    """启动后端服务"""
    backend_script = os.path.join(current_dir, "backend", "start_backend.py")
    print("正在启动后端服务...")
    process = subprocess.Popen([sys.executable, backend_script],
                              stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT,
                              universal_newlines=True)
    
    # 实时输出后端日志
    for line in process.stdout:
        print(f"[后端] {line.strip()}")

def main():
    # 加载配置
    frontend_config, backend_config = load_config()
    
    # 显示服务器信息
    if frontend_config:
        frontend_settings = frontend_config.get("frontend", {})
        frontend_host = frontend_settings.get("host", "0.0.0.0")
        frontend_port = frontend_settings.get("port", 8003)
        print(f"前端将运行在: http://{frontend_host}:{frontend_port}/fintech")
    else:
        print("前端将使用默认配置运行")
    
    if backend_config:
        backend_settings = backend_config.get("backend", {})
        backend_host = backend_settings.get("host", "0.0.0.0")
        backend_port = backend_settings.get("port", 8001)
        print(f"后端将运行在: http://{backend_host}:{backend_port}")
    else:
        print("后端将使用默认配置运行")
    
    print(f"外部访问地址: https://mdi.hkust-gz.edu.cn/fintech/")
    
    # 使用线程同时启动前端和后端
    frontend_thread = threading.Thread(target=start_frontend)
    backend_thread = threading.Thread(target=start_backend)
    
    # 设置为守护线程，这样当主程序退出时，这些线程也会退出
    frontend_thread.daemon = True
    backend_thread.daemon = True
    
    # 启动线程
    backend_thread.start()
    # 稍微延迟启动前端，让后端先初始化
    time.sleep(2)
    frontend_thread.start()
    
    print("\n两个服务都已启动，按 Ctrl+C 停止...\n")
    
    try:
        # 保持主线程运行
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n正在停止服务...")

if __name__ == "__main__":
    main() 