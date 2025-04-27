# 内网服务器部署说明

## 项目概述

此项目包含前端和后端两部分，已配置为适应域名转发：
- 外部访问地址: `https://mdi.hkust-gz.edu.cn/fintech/`
- 内部部署地址: `http://10.100.0.231:8003/fintech/`
- 域名转发规则: `https://mdi.hkust-gz.edu.cn/fintech/*` → `http://10.100.0.231:8003/fintech/*`

## 部署步骤

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置文件

配置文件已更新，适配了域名转发情况：
- 前端配置: `frontend/config/server_config.json`
- 后端配置: `backend/config/server_config.json`

主要配置项：
- 前端端口: 8003
- 后端端口: 8001
- 前端访问路径: `/fintech`

### 3. 启动服务

使用集成启动脚本同时启动前端和后端：

```bash
python start_all.py
```

或分别启动:

```bash
# 启动后端
python backend/start_backend.py

# 启动前端
python frontend/start_frontend.py
```

### 4. 访问地址

- 内网测试访问: `http://10.100.0.231:8003/fintech/`
- 外网正式访问: `https://mdi.hkust-gz.edu.cn/fintech/`

## 系统架构

```
用户 → HTTPS → mdi.hkust-gz.edu.cn/fintech/* 
    → 域名转发 → 10.100.0.231:8003/fintech/* (前端)
    → API调用 → 10.100.0.231:8001 (后端)
```

## 注意事项

1. 确保10.100.0.231服务器上的8001和8003端口已开放
2. 确保WebSocket连接正常工作
3. 如需更改端口配置，请同时修改：
   - 前端配置文件
   - 后端配置文件
   - 域名转发规则
   - 防火墙设置 