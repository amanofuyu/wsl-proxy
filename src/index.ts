import { execSync } from 'node:child_process'
import os from 'node:os'
import process from 'node:process'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

dotenv.config()

const args = process.argv.slice(2)

function getArgValue<T>(flags: string[], defaultValue: T) {
  const index = args.findIndex(arg => flags.includes(arg))

  if (index !== -1 && args[index + 1]) {
    const val = Number.parseInt(args[index + 1], 10)
    return Number.isNaN(val) ? defaultValue : val
  }

  return defaultValue
}

const LOCAL_PORT = getArgValue(['--port', '-p'], 8001)

const WSL_PORT = getArgValue(['--target', '-t'], 8080)

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

const app = express()

// 中间件
app.use(cors())
app.use(express.json())

// 代理设置
app.use('/', createProxyMiddleware({
  target: `http://${WSL_IP}:${WSL_PORT}`,
  changeOrigin: false,
  ws: true,
}))

// 启动服务器
app.listen(LOCAL_PORT, '0.0.0.0', () => {
  console.log(`🚀 转发服务已启动！`)
  console.log(`🔗 外部访问地址: http://${getLocalIP()}:${LOCAL_PORT}`)
  console.log(`🔗 转发目标: http://${WSL_IP}:${WSL_PORT}`)
})

function getLocalIP() {
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
