# fc-api 部署到阿里云 ECS 服务器

## 服务器信息

| 项目     | 值                |
| -------- | ----------------- |
| 公网 IP  | `47.94.103.221`   |
| 系统     | Ubuntu 22.04 64位 |
| 配置     | 2核2G             |
| 地域     | 华北2（北京）     |
| API 端口 | `3001`            |
| 进程管理 | PM2               |
| 代码目录 | `/root/fc-api`    |

---

## 首次部署（已完成）

### 1. 安装 Node.js 18

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node -v  # 确认 v18.x.x
```

### 2. 上传代码

从本地 Mac 上传整个 fc-api 目录（含 node_modules）：

```bash
scp -r /Users/maoyan/boke/my-blog/fc-api root@47.94.103.221:/root/
```

### 3. 修复并编译

由于 node_modules 从 Mac 传到 Linux 后 typescript 二进制损坏，需要重装：

```bash
cd /root/fc-api
rm -rf node_modules/typescript node_modules/.bin/tsc
npm install --include=dev
npm run build
```

### 4. 创建 .env 配置文件

```bash
cat > /root/fc-api/.env << 'EOF'
MINIMAX_API_KEY=你的key
MINIMAX_GROUP_ID=你的group_id
SUPABASE_DB_URL=postgresql://...
PORT=3001
EOF
```

### 5. 安装 PM2 并启动

```bash
npm install -g pm2
pm2 start dist/index.js --name blog-api
pm2 save       # 保存进程列表
pm2 startup    # 开机自启
```

---

## 日常更新流程

每次修改 `fc-api` 代码后，执行以下步骤：

### 第一步：本地编译（在 Mac 上）

```bash
cd /Users/maoyan/boke/my-blog/fc-api
npm run build
```

### 第二步：上传编译产物到服务器

只上传 `dist` 目录（编译后的 JS 文件），不需要重新上传 node_modules：

```bash
scp -r /Users/maoyan/boke/my-blog/fc-api/dist root@47.94.103.221:/root/fc-api/
```

### 第三步：重启服务

SSH 进服务器重启：

```bash
ssh root@47.94.103.221 "pm2 restart blog-api"
```

或者直接合并成一条命令（本地执行）：

```bash
cd /Users/maoyan/boke/my-blog/fc-api && npm run build && scp -r dist root@47.94.103.221:/root/fc-api/ && ssh root@47.94.103.221 "pm2 restart blog-api"
```

---

## 常用 PM2 命令（在服务器上执行）

```bash
pm2 list                    # 查看所有进程状态
pm2 logs blog-api           # 查看实时日志
pm2 logs blog-api --lines 100  # 查看最近100行日志
pm2 restart blog-api        # 重启服务
pm2 stop blog-api           # 停止服务
pm2 delete blog-api         # 删除进程
```

---

## 验证服务是否正常

```bash
curl http://47.94.103.221:3001/health
# 返回：{"status":"ok","timestamp":"..."}
```

---

## 安全组配置

需要在阿里云 ECS 控制台 → 安全组 中开放以下端口：

| 端口 | 协议 | 用途         |
| ---- | ---- | ------------ |
| 22   | TCP  | SSH 远程登录 |
| 3001 | TCP  | API 服务     |

---

## 博客前端配置

`.env.production` 中配置 API 地址：

```
NEXT_PUBLIC_API_BASE=http://47.94.103.221:3001
```

修改后需要重新构建并部署博客：

```bash
cd /Users/maoyan/boke/my-blog
npm run build && npm run deploy
```
