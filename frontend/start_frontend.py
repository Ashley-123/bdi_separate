import subprocess
import sys
import os
import json
from pathlib import Path

# 获取当前脚本所在目录
current_dir = os.path.dirname(os.path.abspath(__file__))

def load_config():
    """从配置文件加载设置"""
    config_path = os.path.join(current_dir, "config", "server_config.json")
    try:
        with open(config_path, "r") as f:
            config = json.load(f)
        return config
    except Exception as e:
        print(f"加载配置文件失败: {str(e)}，使用默认配置")
        return None

def start_frontend():
    """启动前端服务器，运行在配置指定的端口"""
    print("正在启动前端服务...")
    # 使用子进程运行frontend_server.py
    subprocess.run([sys.executable, os.path.join(current_dir, "frontend_server", "frontend_server.py")])

if __name__ == "__main__":
    # 加载配置
    config = load_config()
    if config:
        frontend_config = config.get("frontend", {})
        host = frontend_config.get("host", "0.0.0.0")
        port = frontend_config.get("port", 8003)
        print(f"前端将运行在: http://{host}:{port}")
    
    # 启动前端服务
    start_frontend() 