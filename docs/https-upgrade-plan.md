# HTTPS 升级方案（方案 B：api 子域名）

> 记录日期：2026-04-24

---

## 一、背景与前因

博客 `lusuijie.com.cn` 原本是纯 HTTP 部署：

- 静态页面：Next.js 构建后上传到**阿里云 OSS**（lusuijie-blog-static，华北2北京）
- 后端 API：Express 服务运行在**阿里云 ECS**（47.94.103.221:3001），由 PM2 管理
- 域名解析：`lusuijie.com.cn` CNAME → `lusuijie-blog-static.oss-cn-beijing.aliyuncs.com`

### 尝试加 SSL 后出现的问题

2026-04-24，在阿里云 OSS 域名管理里绑定了 DigiCert 证书（lusuijie.com.cn.pem + lusuijie.com.cn.key），博客升级为 HTTPS 访问。

**随即出现两个问题：**

1. **混合内容（Mixed Content）被浏览器拦截**  
   页面通过 `https://lusuijie.com.cn` 加载，但前端代码里的 API 地址 `NEXT_PUBLIC_API_BASE=http://47.94.103.221:3001` 仍是 `http://`。  
   浏览器安全策略会强制阻止 HTTPS 页面向 HTTP 地址发请求，导致小说创作、角色图鉴等所有调用 fc-api 的功能报 `Failed to fetch`。

2. **OSS 不能做 API 反向代理**  
   域名 CNAME 指向 OSS，OSS 只能托管静态文件，无法把 `/api/` 路径的请求转发到 ECS 上的 Node 服务。  
   因此简单地把 `NEXT_PUBLIC_API_BASE` 改成同域 `https://lusuijie.com.cn` 也行不通。

**临时处理：** 在 OSS 控制台删除证书绑定，回退到 HTTP，功能恢复正常。

---

## 二、根本原因分析

```
当前架构（HTTP 时没问题）：

浏览器
  └─ http://lusuijie.com.cn  ──CNAME──▶  OSS（静态文件）
  └─ http://47.94.103.221:3001  ────────▶  ECS fc-api（Node.js）

升级 HTTPS 后的问题：

浏览器
  └─ https://lusuijie.com.cn  ──CNAME──▶  OSS（静态文件）✅
  └─ http://47.94.103.221:3001  ────────▶  ECS fc-api ❌ 被浏览器拦截
```

浏览器规则：**HTTPS 页面不允许向任何 HTTP 地址发请求（包括 IP 直连）**。

---

## 三、解决方案：方案 B（api 子域名）

**核心思路：** 主域名 `lusuijie.com.cn` 继续 CNAME 到 OSS，同时新增子域名 `api.lusuijie.com.cn` 的 A 记录指向 ECS，在 ECS 上用 Nginx 做 HTTPS 反向代理。

```
最终架构：

浏览器
  └─ https://lusuijie.com.cn        ──CNAME──▶  OSS（静态文件 + OSS 证书）✅
  └─ https://api.lusuijie.com.cn    ──A──▶  ECS Nginx（443）
                                              └─ 反向代理 ──▶  fc-api:3001 ✅
```

---

## 四、具体操作步骤

### 步骤 1：DNS 解析 - 添加 A 记录

在阿里云**域名控制台 → 解析设置**，添加一条记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---------|---------|--------|-----|
| A | `api` | `47.94.103.221` | 600 |

等待 DNS 生效（通常 1-10 分钟）。

---

### 步骤 2：阿里云 ECS 安全组 - 开放 443 端口

进入 **ECS 控制台 → 安全组 → 入方向规则**，添加：

| 端口范围 | 协议 | 来源 |
|---------|------|------|
| 443/443 | TCP | 0.0.0.0/0 |

---

### 步骤 3：上传证书到 ECS（本地 Mac 执行）

```bash
scp /Users/maoyan/boke/my-blog/lusuijie.com.cn.pem root@47.94.103.221:/etc/ssl/
scp /Users/maoyan/boke/my-blog/lusuijie.com.cn.key root@47.94.103.221:/etc/ssl/
```

> ⚠️ 证书有效期：2026-04-24 ~ 2026-07-23，到期前需要续签并重新上传。

---

### 步骤 4：ECS 安装 Nginx 并配置（SSH 进服务器执行）

```bash
ssh root@47.94.103.221
```

```bash
# 安装 Nginx
apt install -y nginx

# 写入配置
cat > /etc/nginx/sites-available/api << 'EOF'
server {
    listen 443 ssl;
    server_name api.lusuijie.com.cn;

    ssl_certificate     /etc/ssl/lusuijie.com.cn.pem;
    ssl_certificate_key /etc/ssl/lusuijie.com.cn.key;

    # 反向代理到 fc-api 服务
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP 强制跳转 HTTPS
server {
    listen 80;
    server_name api.lusuijie.com.cn;
    return 301 https://$host$request_uri;
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/api /etc/nginx/sites-enabled/

# 测试配置并重启
nginx -t && systemctl restart nginx
```

验证是否正常：

```bash
curl https://api.lusuijie.com.cn/health
# 预期返回：{"status":"ok","timestamp":"..."}
```

---

### 步骤 5：修改 fc-api 的 CORS 允许域名

`fc-api/src/index.ts` 中 CORS 配置需要确认 `https://lusuijie.com.cn` 在白名单内（已有，无需修改）：

```typescript
const allowedOrigins = [
  'https://lusuijie.com.cn',   // ✅ 已有
  'http://localhost:3000',
  // ...
];
```

---

### 步骤 6：修改前端环境变量

`.env.production`：

```
NEXT_PUBLIC_API_BASE=https://api.lusuijie.com.cn
```

同时同步更新 GitHub Secrets（`NEXT_PUBLIC_API_BASE`），否则 CI 构建时会用旧值：

> GitHub 仓库 → Settings → Secrets and variables → Actions → `NEXT_PUBLIC_API_BASE`  
> 改为：`https://api.lusuijie.com.cn`

---

### 步骤 7：在 OSS 重新绑定 HTTPS 证书

回到阿里云 OSS → lusuijie-blog-static → 域名管理，重新为 `lusuijie.com.cn` 绑定证书，开启 HTTPS 强制跳转。

---

### 步骤 8：重新构建并部署博客

```bash
cd /Users/maoyan/boke/my-blog
git add .
git commit -m "fix: 升级 HTTPS，API 改用 api.lusuijie.com.cn 子域名"
git push origin main
# 等待 GitHub Actions 自动构建部署（约 1-2 分钟）
```

---

## 五、完成后的架构

```
用户浏览器
  │
  ├─ https://lusuijie.com.cn（页面）
  │     CNAME → OSS lusuijie-blog-static（华北2）
  │     OSS 证书：lusuijie.com.cn.pem ✅
  │
  └─ https://api.lusuijie.com.cn（API 调用）
        A → ECS 47.94.103.221
        Nginx 443 → 反向代理 → fc-api:3001（PM2）✅
```

---

## 六、证书续签提醒

当前证书为 DigiCert 免费 90 天证书，**到期日：2026-07-23**。

到期前需要：
1. 重新申请证书，获得新的 `.pem` 和 `.key`
2. 替换 OSS 上的证书
3. 替换 ECS `/etc/ssl/` 下的证书文件并 `nginx -s reload`
