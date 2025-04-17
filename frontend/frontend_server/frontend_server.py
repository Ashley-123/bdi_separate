import uvicorn
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import httpx
import json
import re

# 读取服务器配置
config_path = Path(__file__).parent.parent / "config" / "server_config.json"
try:
    with open(config_path, "r") as f:
        server_config = json.load(f)
    
    # 从配置中获取后端和前端设置
    BACKEND_CONFIG = server_config["backend"]
    FRONTEND_CONFIG = server_config["frontend"]
    
    # 设置后端URL
    BACKEND_URL = BACKEND_CONFIG["api_url"]
    BACKEND_WS_URL = BACKEND_CONFIG["ws_url"]
    
    # 设置前端主机和端口
    FRONTEND_HOST = FRONTEND_CONFIG["host"]
    FRONTEND_PORT = FRONTEND_CONFIG["port"]
    
    # 设置外网访问地址
    EXTERNAL_FRONTEND_URL = "https://mdi.hkust-gz.edu.cn/fintech"
    EXTERNAL_BACKEND_API_URL = "/fintech/api"
    EXTERNAL_BACKEND_WS_URL = "wss://mdi.hkust-gz.edu.cn/fintech"
    
    print(f"已从配置文件加载设置: {config_path}")
except Exception as e:
    print(f"加载配置文件失败: {str(e)}，使用默认配置")
    # 默认配置
    BACKEND_URL = "/fintech/api"
    BACKEND_WS_URL = "ws://10.100.0.231:8001"
    FRONTEND_HOST = "0.0.0.0"
    FRONTEND_PORT = 8003
    EXTERNAL_FRONTEND_URL = "https://mdi.hkust-gz.edu.cn/fintech"
    EXTERNAL_BACKEND_API_URL = "/fintech/api"
    EXTERNAL_BACKEND_WS_URL = "wss://mdi.hkust-gz.edu.cn/fintech"

# 创建前端应用
frontend_app = FastAPI(
    title="OpenManus Web Frontend",
    description="OpenManus Web前端服务",
    version="0.1.0",
    # 添加子路径支持
    root_path="/fintech",
)

# 设置CORS
frontend_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法
    allow_headers=["*"],  # 允许所有头
)

# 设置静态文件目录
static_path = Path(__file__).parent.parent / "static"
static_path.mkdir(exist_ok=True)

# 挂载静态文件目录
frontend_app.mount("/static", StaticFiles(directory=str(static_path)), name="static")
frontend_app.mount("/fintech/static", StaticFiles(directory=str(static_path)), name="fintech_static")

# 辅助函数：删除URL中的协议前缀
def remove_protocol(url):
    return re.sub(r'^https?://', '', url)

# 检测是否为外网访问
def is_external_access(request: Request) -> bool:
    host = request.headers.get("host", "")
    # 如果域名中包含 mdi.hkust-gz.edu.cn 则为外网访问
    return "mdi.hkust-gz.edu.cn" in host

# 提供配置接口给前端JavaScript
@frontend_app.get("/config")
async def get_config(request: Request):
    # 检测是内网还是外网访问
    external = is_external_access(request)
    
    # 根据访问方式选择不同的配置
    if external:
        api_url = EXTERNAL_BACKEND_API_URL
        ws_url = EXTERNAL_BACKEND_WS_URL
        print(f"检测到外网访问，使用外网配置 - host: {request.headers.get('host')}")
    else:
        api_url = BACKEND_URL
        ws_url = BACKEND_WS_URL
        print(f"检测到内网访问，使用内网配置 - host: {request.headers.get('host')}")
    
    # 打印当前配置，方便调试
    print(f"提供配置给前端: api_url={api_url}, ws_url={ws_url}")
    
    # 确保ws_url使用正确的格式
    if not ws_url.startswith(("ws://", "wss://")):
        # 如果是外网访问，使用wss://
        if external:
            ws_url = f"wss://{remove_protocol(ws_url)}"
        else:
            ws_url = f"ws://{remove_protocol(ws_url)}"
    
    # 构建HTTP URL，确保使用正确的协议
    if external and not api_url.startswith(("http://", "https://")):
        # 外网访问确保使用HTTPS
        api_url = api_url
    
    return {
        "backend": {
            "api_url": api_url,
            "ws_url": ws_url
        }
    }

# 代理后端API请求
@frontend_app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_api(request: Request, path: str):
    """代理API请求到后端服务器"""
    # 内网环境直接使用内网IP
    backend_server = "http://10.100.0.231:8001"
    url = f"{backend_server}/api/{path}"
    
    # 获取原始请求内容
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    method = request.method
    
    # 获取请求体
    body = await request.body()
    
    # 使用httpx请求后端
    async with httpx.AsyncClient() as client:
        response = await client.request(
            method,
            url,
            headers=headers,
            content=body,
            timeout=30.0
        )
        
        # 返回后端响应
        return JSONResponse(
            content=response.json() if response.headers.get("content-type") == "application/json" else response.text,
            status_code=response.status_code,
            headers=dict(response.headers)
        )

# WebSocket代理路由 - 仅显示提示信息，不做实际代理
@frontend_app.get("/ws/{path:path}")
async def ws_info(request: Request, path: str):
    # 检测是内网还是外网访问
    external = is_external_access(request)
    
    # 根据访问方式选择不同的WebSocket URL
    if external:
        ws_url = EXTERNAL_BACKEND_WS_URL
    else:
        ws_url = BACKEND_WS_URL
    
    return JSONResponse(
        status_code=400,
        content={
            "message": f"WebSocket请求应直接发送到后端服务器 {ws_url}/ws/...，前端服务器不代理WebSocket连接。"
        }
    )

# 设置根路由返回index.html
@frontend_app.get("/")
async def read_index():
    index_path = static_path / "index.html"
    return FileResponse(str(index_path))

# favicon.ico
@frontend_app.get("/favicon.ico")
async def favicon():
    favicon_path = static_path / "favicon.ico"
    if favicon_path.exists():
        return FileResponse(str(favicon_path))
    else:
        return JSONResponse(status_code=404, content={"message": "Favicon not found"})

# 健康检查接口
@frontend_app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    print("启动前端服务...")
    print(f"静态文件目录: {static_path}")
    print(f"后端API地址: {BACKEND_URL}")
    print(f"前端访问地址: http://{FRONTEND_HOST}:{FRONTEND_PORT}/fintech")
    print(f"外网访问地址: {EXTERNAL_FRONTEND_URL}")
    uvicorn.run(frontend_app, host=FRONTEND_HOST, port=FRONTEND_PORT) 