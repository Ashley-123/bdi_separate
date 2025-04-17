import uvicorn
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import json
import socket

from app.web.api import app
from app.logger import logger

# 读取服务器配置
config_path = Path(__file__).parent / "config" / "server_config.json"
try:
    with open(config_path, "r") as f:
        server_config = json.load(f)
    
    # 从配置中获取后端设置
    BACKEND_CONFIG = server_config["backend"]
    
    # 设置后端主机和端口
    BACKEND_HOST = BACKEND_CONFIG["host"]
    BACKEND_PORT = BACKEND_CONFIG["port"]
    
    # 设置外网信息
    EXTERNAL_BACKEND_URL = "https://mdi.hkust-gz.edu.cn/fintech/api"
    
    logger.info(f"已从配置文件加载设置: {config_path}")
except Exception as e:
    logger.error(f"加载配置文件失败: {str(e)}，使用默认配置")
    # 默认配置
    BACKEND_HOST = "0.0.0.0"
    BACKEND_PORT = 8001
    EXTERNAL_BACKEND_URL = "https://mdi.hkust-gz.edu.cn/fintech/api"

# 获取本机IP地址
def get_ip_address():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # 不需要真实连接
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

# 设置静态文件目录
static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")
app.mount("/fintech/static", StaticFiles(directory=str(static_path)), name="fintech_static")

# 添加路由信息到API文档
@app.get("/api-info")
async def api_info():
    return {
        "internal_api": f"http://{BACKEND_HOST}:{BACKEND_PORT}/api",
        "external_api": EXTERNAL_BACKEND_URL,
        "version": "1.0.0"
    }

# 设置根路由返回index.html
@app.get("/")
async def read_index():
    index_path = static_path / "index.html"
    return FileResponse(str(index_path))

# 健康检查接口
@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    local_ip = get_ip_address()
    logger.info("启动HKUST(GZ) BDI Web服务...")
    logger.info(f"静态文件目录: {static_path}")
    logger.info(f"内网访问地址: http://{BACKEND_HOST}:{BACKEND_PORT} 或 http://{local_ip}:{BACKEND_PORT}")
    logger.info(f"外网访问地址: {EXTERNAL_BACKEND_URL}")
    uvicorn.run(app, host=BACKEND_HOST, port=BACKEND_PORT) 