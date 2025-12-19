import { execSync } from 'node:child_process'
import fs from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

dotenv.config()

// ================= 参数解析区 =================
const args = process.argv.slice(2)

function getArgValue(flags: string[], defaultValue: number): number {
  const index = args.findIndex(arg => flags.includes(arg))

  if (index !== -1 && args[index + 1]) {
    const val = Number.parseInt(args[index + 1], 10)
    return Number.isNaN(val) ? defaultValue : val
  }

  return defaultValue
}

const LOCAL_PORT = getArgValue(['--port', '-p'], 8001)
const LOCAL_HTTPS_PORT = getArgValue(['--https-port', '-sp'], 8400 + LOCAL_PORT % 100)
const WSL_PORT = getArgValue(['--target', '-t'], 8080)

// ================= 证书加载区 =================
let sslOptions: { key: ReturnType<typeof fs.readFileSync>, cert: ReturnType<typeof fs.readFileSync> } | null = null
try {
  const keyPath = path.join(__dirname, '../key.pem')
  const certPath = path.join(__dirname, '../cert.pem')
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    sslOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
    console.log('🔐 发现证书文件，HTTPS 模式将开启')
  }
  else {
    console.log('⚠️ 未找到 key.pem 或 cert.pem，仅开启 HTTP 模式')
  }
}
catch (e) {
  console.error('证书加载失败:', (e as Error).message)
}

// ================= WSL IP 获取区 =================
let WSL_IP = ''

try {
  console.log('🔄️ 正在尝试自动获取 WSL IP...')
  const stdout = execSync('wsl hostname -I', { encoding: 'utf8' })
  WSL_IP = stdout.trim().split(' ')[0]

  if (!WSL_IP) {
    throw new Error('获取到的 IP 为空')
  }

  console.log(`✅️ 成功获取 WSL IP: ${WSL_IP}`)
}
catch (e) {
  console.error('❌️ 无法自动获取 WSL IP, 请确保 WSL 正在运行。')
  console.error('❌️ 错误详情:', (e as Error).message)
  process.exit(1)
}

// ================= 服务器启动区 =================
const app = express()

// 中间件
app.use(cors())
app.use(express.json())

// 代理设置
app.use('/', createProxyMiddleware({
  target: `http://${WSL_IP}:${WSL_PORT}`,
  changeOrigin: false,
  ws: true,
  secure: false,
}))

const LOCAL_IP = getLocalIP()

// 启动服务器
app.listen(LOCAL_PORT, '0.0.0.0', () => {
  console.log(`🚀 转发服务已启动！`)
  console.log(`🔗 外部访问地址: http://${LOCAL_IP}:${LOCAL_PORT}`)
  console.log(`🔗 转发目标: http://${WSL_IP}:${WSL_PORT}`)
})

if (sslOptions) {
  const httpsServer = https.createServer(sslOptions, app)

  httpsServer.listen(LOCAL_HTTPS_PORT, '0.0.0.0', () => {
    console.log(`🚀 HTTPS 服务已启动！`)
    console.log(`🔗 外部访问地址: https://${LOCAL_IP}:${LOCAL_HTTPS_PORT}`)
    console.log(`🔗 转发目标: https://${WSL_IP}:${WSL_PORT}`)
  })
}

function getLocalIP(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }

  return 'localhost'
}
